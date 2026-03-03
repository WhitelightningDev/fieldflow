-- Quote request lifecycle:
-- quote_requests -> call-out fee request (mock payment) -> job_cards -> invoices (apply prepaid call-out)
-- Includes: customer portal RPCs + customer-facing notifications + warranty snapshot on invoices.

-- 1) Link quote requests to jobs
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS job_card_id uuid NULL REFERENCES public.job_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quote_requests_job_card_id_idx
  ON public.quote_requests (job_card_id);

-- 2) Call-out fee tracking (one per quote request)
CREATE TABLE IF NOT EXISTS public.quote_request_callouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id uuid NOT NULL UNIQUE REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callout_fee_cents integer NOT NULL,
  vat_percent numeric NOT NULL DEFAULT 15,
  total_cents integer NOT NULL,
  status text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz NULL,
  payment_provider text NOT NULL DEFAULT 'mock',
  payment_reference text NULL,
  applied_invoice_id uuid NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  applied_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT quote_request_callouts_status_check CHECK (status IN ('requested','paid','declined','cancelled'))
);

CREATE INDEX IF NOT EXISTS quote_request_callouts_company_id_idx
  ON public.quote_request_callouts (company_id);
CREATE INDEX IF NOT EXISTS quote_request_callouts_requester_user_id_idx
  ON public.quote_request_callouts (requester_user_id);
CREATE INDEX IF NOT EXISTS quote_request_callouts_status_idx
  ON public.quote_request_callouts (status);

ALTER TABLE public.quote_request_callouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can view quote request callouts" ON public.quote_request_callouts;
CREATE POLICY "Company users can view quote request callouts"
  ON public.quote_request_callouts
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

DROP POLICY IF EXISTS "Requesters can view own quote request callouts" ON public.quote_request_callouts;
CREATE POLICY "Requesters can view own quote request callouts"
  ON public.quote_request_callouts
  FOR SELECT
  TO authenticated
  USING (requester_user_id = auth.uid());

-- 3) Warranty fields (minimal portal visibility)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_warranty_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS warranty_terms text NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS warranty_expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS warranty_terms text NULL;

-- Populate warranty snapshot defaults on invoice creation.
CREATE OR REPLACE FUNCTION public.set_invoice_warranty_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _days integer;
  _terms text;
BEGIN
  SELECT c.default_warranty_days, c.warranty_terms
  INTO _days, _terms
  FROM public.companies c
  WHERE c.id = NEW.company_id
  LIMIT 1;

  IF NEW.warranty_terms IS NULL THEN
    NEW.warranty_terms := COALESCE(_terms, '');
  END IF;

  IF NEW.warranty_expires_at IS NULL THEN
    NEW.warranty_expires_at := now() + ((COALESCE(_days, 90))::text || ' days')::interval;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_warranty_defaults ON public.invoices;
CREATE TRIGGER trg_set_invoice_warranty_defaults
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_warranty_defaults();

-- 4) Customer portal RPCs

-- List quote requests for the authenticated requester (extended fields).
-- NOTE: Postgres cannot `CREATE OR REPLACE` a function when the OUT/RETURN TABLE shape changes.
-- This function was originally created in `20260302150000_quote_request_customer_portal.sql`,
-- so we must drop it before re-creating with the new return columns.
DROP FUNCTION IF EXISTS public.get_my_quote_requests();

CREATE OR REPLACE FUNCTION public.get_my_quote_requests()
RETURNS TABLE (
  id uuid,
  company_name text,
  company_logo_url text,
  trade text,
  message text,
  status text,
  created_at timestamptz,
  callout_status text,
  callout_total_cents integer,
  callout_requested_at timestamptz,
  callout_paid_at timestamptz,
  job_card_id uuid,
  job_status public.job_card_status,
  scheduled_at timestamptz,
  technician_name text,
  invoice_id uuid,
  invoice_number text,
  invoice_status text,
  invoice_total_cents integer,
  invoice_amount_paid_cents integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    qr.id,
    c.name AS company_name,
    c.logo_url AS company_logo_url,
    qr.trade,
    qr.message,
    qr.status,
    qr.created_at,
    qrc.status AS callout_status,
    qrc.total_cents AS callout_total_cents,
    qrc.requested_at AS callout_requested_at,
    qrc.paid_at AS callout_paid_at,
    qr.job_card_id,
    jc.status AS job_status,
    jc.scheduled_at,
    t.name AS technician_name,
    inv.id AS invoice_id,
    inv.invoice_number,
    inv.status AS invoice_status,
    inv.total_cents AS invoice_total_cents,
    inv.amount_paid_cents AS invoice_amount_paid_cents
  FROM public.quote_requests qr
  JOIN public.companies c ON c.id = qr.company_id
  LEFT JOIN public.quote_request_callouts qrc ON qrc.quote_request_id = qr.id
  LEFT JOIN public.job_cards jc ON jc.id = qr.job_card_id
  LEFT JOIN public.technicians t ON t.id = jc.technician_id
  LEFT JOIN LATERAL (
    SELECT i.*
    FROM public.invoices i
    WHERE i.job_card_id = jc.id
    ORDER BY i.created_at DESC
    LIMIT 1
  ) inv ON true
  WHERE qr.requester_user_id = auth.uid()
  ORDER BY qr.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_quote_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_quote_requests() TO authenticated;

-- Detailed view payload for portal.
CREATE OR REPLACE FUNCTION public.get_my_quote_request_detail(_quote_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _qr record;
  _callout public.quote_request_callouts%rowtype;
  _has_callout boolean := false;
  _job public.job_cards%rowtype;
  _has_job boolean := false;
  _tech_name text;
  _inv public.invoices%rowtype;
  _has_inv boolean := false;
BEGIN
  SELECT
    qr.*,
    c.name AS company_name,
    c.logo_url AS company_logo_url
  INTO _qr
  FROM public.quote_requests qr
  JOIN public.companies c ON c.id = qr.company_id
  WHERE qr.id = _quote_request_id
    AND qr.requester_user_id = auth.uid()
  LIMIT 1;

  IF _qr IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;

  SELECT *
  INTO _callout
  FROM public.quote_request_callouts qrc
  WHERE qrc.quote_request_id = _quote_request_id
  LIMIT 1;
  _has_callout := FOUND;

  IF _qr.job_card_id IS NOT NULL THEN
    SELECT jc.*
    INTO _job
    FROM public.job_cards jc
    WHERE jc.id = _qr.job_card_id
    LIMIT 1;
    _has_job := FOUND;

    IF _has_job THEN
      IF _job.technician_id IS NOT NULL THEN
        SELECT t.name INTO _tech_name
        FROM public.technicians t
        WHERE t.id = _job.technician_id
        LIMIT 1;
      END IF;

      SELECT i.*
      INTO _inv
      FROM public.invoices i
      WHERE i.job_card_id = _job.id
      ORDER BY i.created_at DESC
      LIMIT 1;
      _has_inv := FOUND;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'quote', jsonb_build_object(
      'id', _qr.id,
      'company_id', _qr.company_id,
      'company_name', _qr.company_name,
      'company_logo_url', _qr.company_logo_url,
      'name', _qr.name,
      'email', _qr.email,
      'phone', _qr.phone,
      'trade', _qr.trade,
      'address', _qr.address,
      'message', _qr.message,
      'status', _qr.status,
      'created_at', _qr.created_at,
      'job_card_id', _qr.job_card_id
    ),
    'callout', CASE WHEN NOT _has_callout THEN NULL ELSE jsonb_build_object(
      'id', _callout.id,
      'status', _callout.status,
      'callout_fee_cents', _callout.callout_fee_cents,
      'vat_percent', _callout.vat_percent,
      'total_cents', _callout.total_cents,
      'requested_at', _callout.requested_at,
      'paid_at', _callout.paid_at,
      'payment_provider', _callout.payment_provider,
      'payment_reference', _callout.payment_reference,
      'applied_invoice_id', _callout.applied_invoice_id,
      'applied_at', _callout.applied_at
    ) END,
    'job', CASE WHEN NOT _has_job THEN NULL ELSE jsonb_build_object(
      'id', _job.id,
      'status', _job.status,
      'scheduled_at', _job.scheduled_at,
      'technician_id', _job.technician_id,
      'technician_name', _tech_name,
      'title', _job.title,
      'description', _job.description,
      'updated_at', _job.updated_at
    ) END,
    'invoice', CASE WHEN NOT _has_inv THEN NULL ELSE jsonb_build_object(
      'id', _inv.id,
      'invoice_number', _inv.invoice_number,
      'status', _inv.status,
      'line_items', _inv.line_items,
      'subtotal_cents', _inv.subtotal_cents,
      'vat_percent', _inv.vat_percent,
      'vat_cents', _inv.vat_cents,
      'total_cents', _inv.total_cents,
      'amount_paid_cents', _inv.amount_paid_cents,
      'created_at', _inv.created_at,
      'sent_at', _inv.sent_at,
      'warranty_expires_at', _inv.warranty_expires_at,
      'warranty_terms', _inv.warranty_terms
    ) END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_quote_request_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_quote_request_detail(uuid) TO authenticated;

-- Mock payment: mark callout paid and create a job card (once).
CREATE OR REPLACE FUNCTION public.pay_quote_request_callout_mock(_quote_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _qr record;
  _callout record;
  _customer_id uuid;
  _site_id uuid;
  _job_id uuid;
  _trade text;
  _title text;
  _desc text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT *
  INTO _qr
  FROM public.quote_requests qr
  WHERE qr.id = _quote_request_id
    AND qr.requester_user_id = _uid
  LIMIT 1;

  IF _qr IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;

  SELECT *
  INTO _callout
  FROM public.quote_request_callouts qrc
  WHERE qrc.quote_request_id = _quote_request_id
    AND qrc.requester_user_id = _uid
  FOR UPDATE;

  IF _callout IS NULL THEN
    RAISE EXCEPTION 'callout not requested';
  END IF;

  IF _callout.status = 'paid' THEN
    RETURN _qr.job_card_id;
  END IF;

  IF _callout.status <> 'requested' THEN
    RAISE EXCEPTION 'callout not payable';
  END IF;

  UPDATE public.quote_request_callouts
  SET status = 'paid',
      paid_at = now(),
      payment_provider = 'mock'
  WHERE id = _callout.id;

  UPDATE public.quote_requests
  SET status = 'callout-paid'
  WHERE id = _quote_request_id;

  -- If job already exists, don't create another.
  IF _qr.job_card_id IS NOT NULL THEN
    _job_id := _qr.job_card_id;
  ELSE
    -- Customer: reuse by email if present
    SELECT c.id INTO _customer_id
    FROM public.customers c
    WHERE c.company_id = _qr.company_id
      AND lower(COALESCE(c.email, '')) = lower(_qr.email)
    LIMIT 1;

    IF _customer_id IS NULL THEN
      INSERT INTO public.customers (company_id, name, email, phone, address, notes)
      VALUES (
        _qr.company_id,
        COALESCE(NULLIF(trim(_qr.name), ''), 'Customer'),
        _qr.email,
        _qr.phone,
        _qr.address,
        'Created from quote request ' || _quote_request_id::text
      )
      RETURNING id INTO _customer_id;
    END IF;

    -- Site: reuse by address when available
    IF COALESCE(NULLIF(trim(_qr.address), ''), '') <> '' THEN
      SELECT s.id INTO _site_id
      FROM public.sites s
      WHERE s.company_id = _qr.company_id
        AND s.customer_id = _customer_id
        AND lower(COALESCE(s.address, '')) = lower(_qr.address)
      LIMIT 1;
    END IF;

    IF _site_id IS NULL THEN
      INSERT INTO public.sites (company_id, customer_id, name, address, notes)
      VALUES (
        _qr.company_id,
        _customer_id,
        COALESCE(NULLIF(trim(_qr.address), ''), COALESCE(NULLIF(trim(_qr.name), ''), 'Site')),
        _qr.address,
        'Created from quote request ' || _quote_request_id::text
      )
      RETURNING id INTO _site_id;
    END IF;

    _trade := COALESCE(NULLIF(trim(_qr.trade), ''), 'plumbing');
    _title := 'Quote request call-out';
    _desc := COALESCE(NULLIF(trim(_qr.message), ''), 'Call-out requested via quote form.');

    INSERT INTO public.job_cards (company_id, trade_id, title, description, status, customer_id, site_id, technician_id, scheduled_at, notes, checklist)
    VALUES (
      _qr.company_id,
      _trade,
      _title,
      _desc,
      'new',
      _customer_id,
      _site_id,
      NULL,
      NULL,
      'Origin: quote request ' || _quote_request_id::text,
      '[]'::jsonb
    )
    RETURNING id INTO _job_id;

    UPDATE public.quote_requests
    SET job_card_id = _job_id
    WHERE id = _quote_request_id
      AND job_card_id IS NULL;
  END IF;

  -- Customer-facing notification (in-app)
  INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
  VALUES (
    _uid,
    _qr.company_id,
    'callout_paid',
    'Call-out fee paid',
    'Payment received — technician dispatch will be scheduled.',
    jsonb_build_object('quote_request_id', _quote_request_id, 'job_card_id', _job_id)
  );

  RETURN _job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_quote_request_callout_mock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_quote_request_callout_mock(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_quote_request_callout(_quote_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _qr record;
  _callout record;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT *
  INTO _qr
  FROM public.quote_requests qr
  WHERE qr.id = _quote_request_id
    AND qr.requester_user_id = _uid
  LIMIT 1;

  IF _qr IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;

  SELECT *
  INTO _callout
  FROM public.quote_request_callouts qrc
  WHERE qrc.quote_request_id = _quote_request_id
    AND qrc.requester_user_id = _uid
  FOR UPDATE;

  IF _callout IS NULL THEN
    RAISE EXCEPTION 'callout not requested';
  END IF;

  IF _callout.status <> 'requested' THEN
    RAISE EXCEPTION 'callout not declinable';
  END IF;

  UPDATE public.quote_request_callouts
  SET status = 'declined'
  WHERE id = _callout.id;

  UPDATE public.quote_requests
  SET status = 'callout-declined'
  WHERE id = _quote_request_id;

  INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
  VALUES (
    _uid,
    _qr.company_id,
    'callout_declined',
    'Call-out declined',
    'You declined the call-out fee request. If this was a mistake, contact the business.',
    jsonb_build_object('quote_request_id', _quote_request_id)
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decline_quote_request_callout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_quote_request_callout(uuid) TO authenticated;

-- 5) Customer-facing lifecycle notifications (job status/assignment/scheduling)
CREATE OR REPLACE FUNCTION public.notify_requester_on_job_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _qr_id uuid;
  _requester_user_id uuid;
BEGIN
  SELECT qr.id, qr.requester_user_id
  INTO _qr_id, _requester_user_id
  FROM public.quote_requests qr
  WHERE qr.job_card_id = NEW.id
    AND qr.requester_user_id IS NOT NULL
  LIMIT 1;

  IF _qr_id IS NULL OR _requester_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.technician_id IS NOT NULL AND (OLD.technician_id IS DISTINCT FROM NEW.technician_id) THEN
    INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
    VALUES (
      _requester_user_id,
      NEW.company_id,
      'job_assigned_customer',
      'Technician assigned',
      'A technician has been assigned to your job.',
      jsonb_build_object('quote_request_id', _qr_id, 'job_card_id', NEW.id)
    );
  END IF;

  IF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at AND NEW.scheduled_at IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
    VALUES (
      _requester_user_id,
      NEW.company_id,
      'job_scheduled_customer',
      'Job scheduled',
      'Your call-out has been scheduled.',
      jsonb_build_object('quote_request_id', _qr_id, 'job_card_id', NEW.id, 'scheduled_at', NEW.scheduled_at)
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
    VALUES (
      _requester_user_id,
      NEW.company_id,
      'job_status_changed_customer',
      'Job status updated',
      'Status changed to ' || NEW.status::text,
      jsonb_build_object('quote_request_id', _qr_id, 'job_card_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_requester_on_job_update ON public.job_cards;
CREATE TRIGGER trg_notify_requester_on_job_update
  AFTER UPDATE ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_requester_on_job_update();

-- 6) Apply prepaid call-out to invoices automatically
CREATE OR REPLACE FUNCTION public.apply_paid_callout_to_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _callout_id uuid;
  _total integer;
  _paid_at timestamptz;
  _new_paid integer;
  _new_status text;
  _invoice_total integer;
BEGIN
  SELECT qrc.id, qrc.total_cents, qrc.paid_at
  INTO _callout_id, _total, _paid_at
  FROM public.quote_requests qr
  JOIN public.quote_request_callouts qrc ON qrc.quote_request_id = qr.id
  WHERE qr.job_card_id = NEW.job_card_id
    AND qrc.status = 'paid'
    AND qrc.applied_invoice_id IS NULL
  LIMIT 1;

  IF _callout_id IS NULL OR COALESCE(_total, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.invoice_payments (invoice_id, company_id, amount_cents, payment_method, reference, paid_at)
  VALUES (
    NEW.id,
    NEW.company_id,
    _total,
    'other',
    'callout-fee (prepaid)',
    COALESCE(_paid_at, now())
  );

  _invoice_total := COALESCE(NEW.total_cents, 0);
  _new_paid := LEAST(_invoice_total, COALESCE(NEW.amount_paid_cents, 0) + _total);
  IF _new_paid >= _invoice_total THEN
    _new_status := 'paid';
  ELSE
    _new_status := 'partial';
  END IF;

  UPDATE public.invoices
  SET amount_paid_cents = _new_paid,
      status = _new_status
  WHERE id = NEW.id;

  UPDATE public.quote_request_callouts
  SET applied_invoice_id = NEW.id,
      applied_at = now()
  WHERE id = _callout_id
    AND applied_invoice_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_paid_callout_to_invoice ON public.invoices;
CREATE TRIGGER trg_apply_paid_callout_to_invoice
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_paid_callout_to_invoice();

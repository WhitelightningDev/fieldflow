-- Fix: avoid "record ... is not assigned yet" in portal RPC when job/callout/invoice is missing.
-- This can happen when a quote request has no job_card_id yet (pre-payment) or no callout row exists.

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

  SELECT qrc.*
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
        SELECT t.name
        INTO _tech_name
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


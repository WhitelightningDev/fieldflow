-- Improve job card notes created from quote requests:
-- - Include requester/contact snapshot + quote request id
-- - Separate read-only request block from technician notes using a delimiter

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
  _origin_notes text;
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

    _origin_notes :=
      'Quote request: ' || _quote_request_id::text || E'\n' ||
      'Submitted: ' || to_char(_qr.created_at, 'YYYY-MM-DD HH24:MI') || E'\n' ||
      'Trade: ' || COALESCE(NULLIF(trim(_qr.trade), ''), '—') || E'\n' ||
      'Requester: ' ||
        COALESCE(NULLIF(trim(_qr.name), ''), '—') || ' · ' ||
        COALESCE(NULLIF(trim(_qr.phone), ''), '—') || ' · ' ||
        COALESCE(NULLIF(trim(_qr.email), ''), '—') || E'\n' ||
      'Address: ' || COALESCE(NULLIF(trim(_qr.address), ''), '—') || E'\n' ||
      E'\n--- TECH NOTES ---\n';

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
      _origin_notes,
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


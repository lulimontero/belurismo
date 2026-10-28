
### GET /api/v1/account/balances — Get the organization's wallet balances
Returns the available balance for each supported currency the organization holds, along with the yield it pays when there is one and what it has already accrued. Currencies outside the supported catalog are omitted. Amounts are decimal strings.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Wallet balances
    - data*: array — 
      - currencyCode*: string — Currency code
      - name*: string — Currency name
      - type*: string enum=['fiat', 'crypto', 'stablecoin', 'fiat_token'] — Currency type
      - decimals*: number — Decimal precision
      - available*: string — Available balance as a decimal string
      - earned*:  — Yield the currency already accrued. Always present, zeroed when there is none — unlike `yield`.
        allOf:
          - total*: string — Lifetime accrued yield, as a decimal string in the currency decimals
          - today*: string — Accrued since midnight, cut by the server timezone
          - month*: string — Accrued since the 1st of the month, cut by the server timezone
      - yield:  — Yield the currency pays. Absent when it pays none — which is not the same as 0%.
        allOf:
          - rate*: string — Annual rate the yield engine accrues, as a percentage string
          - extraYield: string — Campaign boost on top of `rate`, paid as separate reward transactions. Only present while a campaign applies.
          - totalYield: string — `rate` plus `extraYield`. Present whenever `extraYield` is.
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/account/deposit-addresses — Get the organization's deposit addresses
Returns the deposit addresses per supported currency and network. Optionally filter by the `currency` query param (currency code, e.g. USDT).
  param query:currency string  — Currency code, e.g. USDT
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Deposit addresses
    - data*: array — 
      - currencyCode*: string — Currency code
      - network*: string — Address rail / network
      - value*: string — Deposit address value
  RESP 401: Missing or insufficient credentials
  RESP 404: Unsupported currency
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/transactions — List the organization's transactions
The organization's full history as the ledger reports it, newest first: movements initiated through the API, made from the app and received. Quotes that were never confirmed do not appear. Optionally filter by `type`, by a `from`/`to` range and by `currency`. Statuses are fresh from the ledger. Each movement carries `receipt`: what the belo app receipt shows for its type (counterparty, debits, fee and taxes, the conversion applied, network and hash, bank reference).
  param query:limit number  — Maximum number of items to return
  param query:page number  — Page number (1-indexed)
  param query:type string ['deposit', 'withdrawal', 'swap', 'transfer', 'pix_payout'] — Filter by transaction type
  param query:from string  — Only transactions created at or after this instant (ISO-8601)
  param query:to string  — Only transactions created at or before this instant (ISO-8601)
  param query:currency string  — Filter by the currency of the movement
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Paginated transactions
    - data*: array — 
      - id*: string [uuid] — Transaction id
      - type*: string enum=['deposit', 'withdrawal', 'swap', 'transfer', 'pix_payout'] — 
      - status*: string enum=['pending', 'success', 'failed'] — 
      - amount*: string nullable — Amount denominated in `currency`
      - currency*: string nullable — Currency the amount is denominated in
      - metadata*: object nullable — Echo of the request parameters: address/addressType for transfers, pairCode/type for swaps
      - receipt*:  nullable — What the belo app receipt shows for this movement, fresh from the ledger. Null when the ledger could not be read
        allOf:
          - counterparty*:  nullable — Who sent or receives. Null for a swap and for an on-chain deposit
            allOf:
              <CounterpartyDto>
          - debits*: array — What left each balance, fee and taxes included. Empty when nothing was debited
          - netAmount*: string nullable — Amount before fee and taxes: what was credited, or what the recipient got
          - netCurrency*: string nullable — As the app receipt prints it: a peso deposit reads ARGt
          - fee*: string nullable — Fee charged
          - feeCurrency*: string nullable — 
          - taxes*: string nullable — Taxes withheld or charged
          - taxCurrency*: string nullable — 
          - conversion*:  nullable — The conversion applied, when the movement converted between currencies
            allOf:
              <ConversionDto>
          - network*: string enum=['BITCOIN', 'BITCOIN_LIGHTNING', 'ETHEREUM', 'TRON', 'POLYGON', 'OPTIMISM', 'ARBITRUM_ONE', 'BSC', 'SOLANA', 'PLASMA', 'BASE', 'STELLAR', 'AVALANCHE', 'CVU', 'CBU', 'ALIAS', 'QR', 'PIX', 'BELOTAG', 'EMAIL', 'USER', 'DEPAY_QR'] nullable — Network of an on-chain movement
          - transactionHash*: string nullable — On-chain transaction hash
          - explorerUrl*: string nullable — Block explorer link of an on-chain movement
          - bankReference*: string nullable — Reference of the bank rail: Coelsa id (Argentina) or pix end-to-end id
      - createdAt*: string [date-time] — 
      - updatedAt*: string [date-time] — 
    - pagination*: object — 
      - total: number — 
      - limit: number — 
      - currentPage: number — 
      - nextPage: number nullable — 
      - prevPage: number nullable — 
  RESP 400: Invalid query parameters
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/transactions/{id} — Get a transaction by id
Returns a single transaction by the id returned from preview/confirm, with its `receipt` read from the provider. While the transaction is pending, the status is refreshed in the same read; terminal statuses (success/failed) are returned as stored, and with `receipt: null` if the provider cannot be read.
  param path:id* string  — 
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Transaction
    - id*: string [uuid] — Transaction id
    - type*: string enum=['deposit', 'withdrawal', 'swap', 'transfer', 'pix_payout'] — 
    - status*: string enum=['pending', 'success', 'failed'] — 
    - amount*: string nullable — Amount denominated in `currency`
    - currency*: string nullable — Currency the amount is denominated in
    - metadata*: object nullable — Echo of the request parameters: address/addressType for transfers, pairCode/type for swaps
    - receipt*:  nullable — What the belo app receipt shows for this movement, fresh from the ledger. Null when the ledger could not be read
      allOf:
        - counterparty*:  nullable — Who sent or receives. Null for a swap and for an on-chain deposit
          allOf:
            - name*: string nullable — Name of who sent (deposit) or receives (transfer, pix withdrawal)
            - bank*: string nullable — Bank or institution of the account
            - belotag*: string nullable — belo user handle
            - account*: string nullable — CVU, CBU, alias, pix key or on-chain address. Null on rails where the value is not a public account (belo user, email, QR)
            - accountType*: string enum=['BITCOIN', 'BITCOIN_LIGHTNING', 'ETHEREUM', 'TRON', 'POLYGON', 'OPTIMISM', 'ARBITRUM_ONE', 'BSC', 'SOLANA', 'PLASMA', 'BASE', 'STELLAR', 'AVALANCHE', 'CVU', 'CBU', 'ALIAS', 'QR', 'PIX', 'BELOTAG', 'EMAIL', 'USER', 'DEPAY_QR'] nullable — 
        - debits*: array — What left each balance, fee and taxes included. Empty when nothing was debited
          - currency*: string — Balance the funds are taken from
          - amount*: string — Amount taken from that balance, fee and taxes included
        - netAmount*: string nullable — Amount before fee and taxes: what was credited, or what the recipient got
        - netCurrency*: string nullable — As the app receipt prints it: a peso deposit reads ARGt
        - fee*: string nullable — Fee charged
        - feeCurrency*: string nullable — 
        - taxes*: string nullable — Taxes withheld or charged
        - taxCurrency*: string nullable — 
        - conversion*:  nullable — The conversion applied, when the movement converted between currencies
          allOf:
            - pairCode*: string nullable — Pair as BASE/QUOTE
            - type*: string enum=['BUY', 'SELL'] nullable — 
            - price*: string — Price of one base in quote
            - baseAmount*: string nullable — Amount of the base currency
            - quoteAmount*: string nullable — Amount of the quote currency
        - network*: string enum=['BITCOIN', 'BITCOIN_LIGHTNING', 'ETHEREUM', 'TRON', 'POLYGON', 'OPTIMISM', 'ARBITRUM_ONE', 'BSC', 'SOLANA', 'PLASMA', 'BASE', 'STELLAR', 'AVALANCHE', 'CVU', 'CBU', 'ALIAS', 'QR', 'PIX', 'BELOTAG', 'EMAIL', 'USER', 'DEPAY_QR'] nullable — Network of an on-chain movement
        - transactionHash*: string nullable — On-chain transaction hash
        - explorerUrl*: string nullable — Block explorer link of an on-chain movement
        - bankReference*: string nullable — Reference of the bank rail: Coelsa id (Argentina) or pix end-to-end id
    - createdAt*: string [date-time] — 
    - updatedAt*: string [date-time] — 
  RESP 400: Invalid transaction id
  RESP 401: Missing or insufficient credentials
  RESP 404: Transaction not found
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/swaps/preview — Preview a swap
Returns a quote for swapping between two currencies and records it as a pending transaction. Confirm it with the returned id before the quote expires.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - pairCode*: string — Trading pair code
    - quoteAmount*: string — Amount denominated in the quote currency, as a decimal string
    - quoteCurrency*: string — Currency code the amount is denominated in
    - type*: string enum=['BUY', 'SELL'] — Swap direction
  RESP 200: Swap quote
    - id*: string [uuid] — Transaction id — use it to confirm the swap
    - status*: string enum=['pending', 'success', 'failed'] — 
    - pairCode*: string — 
    - type*: string enum=['BUY', 'SELL'] — 
    - price*: string nullable — Quoted price
    - baseAmount*: string nullable — Base currency amount
    - quoteAmount*: string nullable — Quote currency amount
    - expiresAt*: string nullable — Quote expiry (ISO 8601)
  RESP 401: Missing or insufficient credentials
  RESP 404: Unsupported currency
  RESP 422: Idempotency-Key reused with a different payload
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### PUT /api/v1/swaps/confirm/{id} — Confirm a swap
Executes a previously previewed swap by its transaction id. With a person credential nothing runs here: the person confirms the operation in belo, and repeating this call returns the result.
  param path:id* string  — 
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  param header:X-Belo-Human-Confirmed string  — Only read for a person credential while the approval flow is switched off: `true` once the person confirmed the operation to the caller. Any other value counts as absent.
  RESP 200: Confirmed swap
    - id*: string [uuid] — Transaction id
    - status*: string enum=['pending', 'success', 'failed'] — 
  RESP 401: Missing or insufficient credentials
  RESP 403: approval_required: a person credential has to confirm in belo first; `details` carries approvalId, approvalUrl and expiresAt. approval_denied: the person rejected it.
  RESP 404: Swap not found
  RESP 409: approval_expired, approval_conflict (another person, an API key on an operation with an approval, or already confirmed elsewhere), confirm_in_progress, request_in_progress, or human_confirmation_required (approvals switched off: confirm with the person and retry with X-Belo-Human-Confirmed: true)
  RESP 422: quote_expired: the preview has to be requested again; or the business rejection of the execution the person confirmed (e.g. insufficient_funds)
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/transfers/networks — List the networks a currency can be sent over
Returns, for one currency, every network a transfer can use with its minimum, maximum and fee. Read it before previewing a transfer: pick a network whose `available` is true and an amount between `minAmount` and `maxAmount`. Internal belo transfers (BELOTAG) are always listed; on-chain networks only when sending on-chain is enabled for the account.
  param query:currency* string  — Currency code to send
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Networks of the currency
    - currency*: string — 
    - networks*: array — 
      - addressType*: string enum=['BITCOIN', 'BITCOIN_LIGHTNING', 'ETHEREUM', 'TRON', 'POLYGON', 'OPTIMISM', 'ARBITRUM_ONE', 'BSC', 'SOLANA', 'PLASMA', 'BASE', 'STELLAR', 'AVALANCHE', 'CVU', 'CBU', 'ALIAS', 'QR', 'PIX', 'BELOTAG', 'EMAIL', 'USER', 'DEPAY_QR'] — Pass it as `addressType` to the transfer preview
      - minAmount*: string — Smallest amount this network accepts
      - maxAmount*: string — Largest amount this network accepts
      - fee*: string — Network fee, in the currency
      - available*: boolean — Whether sending over this network is enabled right now
  RESP 400: Invalid query parameters
  RESP 401: Missing or insufficient credentials
  RESP 404: Unsupported currency
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/transfers/preview — Preview a transfer
Returns a quote for sending funds to an external address and records it as a pending transaction. Confirm it with the returned id before the quote expires. `debits` lists which balances fund it and how much comes out of each, fee and `taxes` included; `exchangeRate` prices an implicit conversion between them and the currency sent.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - address*: string — Destination address — loki validates it for the rail
    - addressType*: string enum=['BITCOIN', 'BITCOIN_LIGHTNING', 'ETHEREUM', 'TRON', 'POLYGON', 'OPTIMISM', 'ARBITRUM_ONE', 'BSC', 'SOLANA', 'PLASMA', 'BASE', 'STELLAR', 'AVALANCHE', 'CVU', 'CBU', 'ALIAS', 'QR', 'PIX', 'BELOTAG', 'EMAIL', 'USER', 'DEPAY_QR'] — Rail the destination address belongs to
    - quoteAmount*: string — Amount denominated in the quote currency, as a decimal string
    - currency*: string — Currency code being sent
    - quoteCurrency: string — Currency code the amount is denominated in. Defaults to currency.
  RESP 200: Transfer quote
    - id*: string [uuid] — Transaction id — use it to confirm the transfer
    - status*: string enum=['pending', 'success', 'failed'] — 
    - address*: string — 
    - addressType*: string enum=['BITCOIN', 'BITCOIN_LIGHTNING', 'ETHEREUM', 'TRON', 'POLYGON', 'OPTIMISM', 'ARBITRUM_ONE', 'BSC', 'SOLANA', 'PLASMA', 'BASE', 'STELLAR', 'AVALANCHE', 'CVU', 'CBU', 'ALIAS', 'QR', 'PIX', 'BELOTAG', 'EMAIL', 'USER', 'DEPAY_QR'] — 
    - currency*: string — 
    - amount*: string nullable — What the destination receives, before fee and taxes. What actually leaves each balance is in `debits`
    - fee*: string nullable — Transfer fee, included in `debits`
    - exchangeRate*:  nullable — Rate of the conversion between the balance debited and the currency sent, when there is one. Null when no conversion applies or both sides are the same money (ARGt and ARS)
      allOf:
        - base*: string — Currency of the "1" side, the larger unit
        - quote*: string — Currency the rate is expressed in
        - rate*: string — How much `quote` one `base` is worth
    - expiresAt*: string nullable — Quote expiry (ISO 8601)
    - debits*: array — What the transfer takes out of each balance, one entry per currency — more than one when it is funded from several balances. Fee and taxes are included. Empty when it is not known.
      - currency*: string — Balance the funds are taken from
      - amount*: string — Amount taken from that balance, fee and taxes included
  RESP 401: Missing or insufficient credentials
  RESP 404: Unsupported currency
  RESP 422: Insufficient funds, invalid address or limit exceeded
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### PUT /api/v1/transfers/confirm/{id} — Confirm a transfer
Executes a previously previewed transfer by its transaction id. Settlement is async, so the response returns a pending status. With a person credential nothing runs here: the person confirms the operation in belo, and repeating this call returns the result.
  param path:id* string  — 
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  param header:X-Belo-Human-Confirmed string  — Only read for a person credential while the approval flow is switched off: `true` once the person confirmed the operation to the caller. Any other value counts as absent.
  RESP 200: Confirmed transfer
    - id*: string [uuid] — Transaction id
    - status*: string enum=['pending', 'success', 'failed'] — Settlement is async — a confirmed transfer starts as pending
  RESP 401: Missing or insufficient credentials
  RESP 403: approval_required: a person credential has to confirm in belo first; `details` carries approvalId, approvalUrl and expiresAt. approval_denied: the person rejected it.
  RESP 404: Transfer not found
  RESP 409: approval_expired, approval_conflict (another person, an API key on an operation with an approval, or already confirmed elsewhere), confirm_in_progress, request_in_progress, or human_confirmation_required (approvals switched off: confirm with the person and retry with X-Belo-Human-Confirmed: true)
  RESP 422: quote_expired: the preview has to be requested again; or the business rejection of the execution the person confirmed (e.g. insufficient_funds)
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/payments — Create a payment
Creates a payment and returns the `checkoutUrl` to share with the payer. `type: link` (default) is reusable and accepts any number of payments; `type: one_time` is single-use — ideal for order checkouts — and its expiration is capped at 10 minutes (the response `expiresAt` reflects the effective value). Omit `amount` for an open-amount link where the payer chooses the amount. `expiresAt` is ISO-8601 and must be in the future.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - type: string enum=['link', 'one_time'] — `link` (default) is reusable and accepts any number of payments until it expires. `one_time` is single-use: it accepts exactly one payment and its expiration is capped at 10 minutes — the response `expiresAt` reflects the effective value.
    - paymentMethodIds*: array — Payment method ids accepted by this link, as returned by GET /payments/methods
    - currencyCode*: string — Currency the payment is denominated in
    - productTitle*: string — Title shown to the payer on the checkout page
    - amount: string — Decimal string. Omit for an open-amount link where the payer chooses the amount.
    - expiresAt: string — ISO-8601 expiration, must be in the future. Defaults upstream when omitted.
    - reference: string — Your internal order id
    - callbackUrlSuccess: string — Server-to-server notification POST when the payment succeeds
    - callbackUrlFailed: string — Server-to-server notification POST when the payment fails
    - redirectUrlSuccess: string — Where the payer's browser goes after a successful payment
    - redirectUrlPending: string — Where the payer's browser goes while the payment is pending
    - redirectUrlFailed: string — Where the payer's browser goes after a failed payment
  RESP 201: Payment link created
    - id*: string — Payment link id
    - checkoutUrl*: string — Hosted checkout URL to share with the payer
    - type*: string enum=['link', 'one_time'] — `link` is reusable; `one_time` accepts a single payment.
    - currencyCode*: string — Currency the payment is denominated in
    - productTitle*: string — Title shown to the payer on the checkout page
    - amount*: string nullable — Amount as a decimal string; null for open-amount links
    - expiresAt*: string [date-time] nullable — Expiration timestamp
    - reference*: string nullable — Your internal order id
    - paymentMethodIds*: array — Payment method ids accepted by this link
    - callbackUrlSuccess*: string nullable — Notification URL called when the payment succeeds
    - callbackUrlFailed*: string nullable — Notification URL called when the payment fails
    - redirectUrlSuccess*: string nullable — Payer redirect after a successful payment
    - redirectUrlPending*: string nullable — Payer redirect while the payment is pending
    - redirectUrlFailed*: string nullable — Payer redirect after a failed payment
  RESP 400: Invalid request or missing Idempotency-Key
  RESP 401: Missing or insufficient credentials
  RESP 403: belo pay is not enabled for the organization
  RESP 404: Unsupported currency
  RESP 422: Amount outside the payment method limits
  RESP 429: Too many requests
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/payments — List the organization's payments
Returns the payments created through the API, paginated with `page`/`limit`. Each call lists a single payment type: pass `type=one_time` for single-use payments; defaults to `link`.
  param query:limit number  — Maximum number of items to return
  param query:page number  — Page number (1-indexed)
  param query:type string ['link', 'one_time'] — Payment type to list. Each call lists a single type; defaults to `link`.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Paginated payment links
    - data*: array — 
      - id*: string — Payment link id
      - checkoutUrl*: string — Hosted checkout URL to share with the payer
      - type*: string enum=['link', 'one_time'] — `link` is reusable; `one_time` accepts a single payment.
      - currencyCode*: string — Currency the payment is denominated in
      - productTitle*: string — Title shown to the payer on the checkout page
      - amount*: string nullable — Amount as a decimal string; null for open-amount links
      - expiresAt*: string [date-time] nullable — Expiration timestamp
      - reference*: string nullable — Your internal order id
      - paymentMethodIds*: array — Payment method ids accepted by this link
      - callbackUrlSuccess*: string nullable — Notification URL called when the payment succeeds
      - callbackUrlFailed*: string nullable — Notification URL called when the payment fails
      - redirectUrlSuccess*: string nullable — Payer redirect after a successful payment
      - redirectUrlPending*: string nullable — Payer redirect while the payment is pending
      - redirectUrlFailed*: string nullable — Payer redirect after a failed payment
    - pagination*: object — 
      - total: number — 
      - limit: number — 
      - currentPage: number — 
      - nextPage: number nullable — 
      - prevPage: number nullable — 
  RESP 400: Invalid query parameters
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/payments/methods — List the available payment methods
Returns the active checkout payment methods with their fees and per-method amount limits. Use the returned ids in `POST /payments`.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Available payment methods
    - data*: array — 
      - id*: string — Payment method id
      - name*: string — Display name
      - key*: string — Stable key for the payment method
      - type*: string — Payment method type
      - settlementCurrencyCode*: string — Currency the payment settles in
      - feeRate*: string — Fee rate applied to the payment
      - minFeeAmount*: string nullable — Minimum fee amount, as a decimal string
      - limits*: object — 
        - min*: string — Minimum payable amount, as a decimal string
        - max*: string — Maximum payable amount, as a decimal string
        - currencyCode*: string — Currency the limits are denominated in
      - imageUrl*: string — Logo URL for the payment method
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/payments/{id}/status — Get the status of a payment
Returns the consolidated payment status: `pending`, `success`, `failed` or `expired`. A payment with no attempt yet reports `pending` (or `expired` past its expiration). For reusable links, pass the `transactionId` received on your callback to resolve a specific payment attempt; `one_time` payments resolve without it. Confirm `success` here before delivering the goods.
  param path:id* string  — 
  param query:transactionId string  — Transaction id received on your callback; used to resolve the status of a specific payment attempt
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Consolidated payment status
    - id*: string — Payment link id
    - transactionId*: string nullable — Transaction id the status was resolved for; null when querying the link itself
    - status*: string enum=['pending', 'success', 'failed', 'expired'] — 
  RESP 401: Missing or insufficient credentials
  RESP 404: Payment or transaction not found
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### DELETE /api/v1/payments/{id} — Cancel a payment
Soft-cancels the payment so it stops accepting payments; applies to both `link` and `one_time` types. This is irreversible.
  param path:id* string  — 
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  RESP 200: Payment link canceled
    - id*: string — Payment link id
    - canceled*: boolean — Whether the payment link was canceled
  RESP 400: Missing Idempotency-Key
  RESP 401: Missing or insufficient credentials
  RESP 404: Payment not found or already canceled
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/pix/recipients — Resolve a pix key
Looks the pix key up in the directory and returns its recipients. An unknown key answers 200 with an empty list. The lookup is quota-bound: do not use it to validate the format of a key.
  param query:address* string  — Pix key to resolve: CPF, CNPJ, email, phone, random key or an EMV QR code
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Recipients for the pix key
    - data*: array — 
      - name*: string nullable — Recipient name as the pix directory reports it
      - address*: string — Pix key the directory resolved
      - addressType*: string — 
  RESP 401: Missing or insufficient credentials
  RESP 403: Pix payout not enabled for the organization, no pix rail available, or terms not accepted
  RESP 422: The pix key is not valid
  RESP 429: Directory lookup quota exhausted
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/pix/payouts/price — Get the pix payout price
Returns the price of the pair on the rail assigned to the organization. Without brlAmount the provider prices its own reference amount.
  param query:brlAmount string  — Amount in BRL to price. Defaults to the provider reference amount.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Pix payout price
    - price*: string — Price as a decimal string
    - pairCode*: string — Quoted pair
  RESP 401: Missing or insufficient credentials
  RESP 403: Pix payout not enabled for the organization, no pix rail available, or terms not accepted
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/pix/payouts/preview — Preview a pix payout
Returns a quote for paying a pix key in BRL and records it as a pending transaction. Confirm it with the returned id before the quote expires. An EMV QR code carrying its own amount overrides the requested one. The payout is funded from the organization’s balances, not from BRL: `debits` lists which ones and how much comes out of each, and `exchangeRate` prices the settlement currency in BRL.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - address*: string — Destination pix key — the provider validates it against the directory
    - amount*: string — Amount in BRL as a decimal string. An EMV QR code that carries its own amount overrides it.
  RESP 200: Pix payout quote
    - id*: string [uuid] — Transaction id — use it to confirm the payout
    - status*: string enum=['pending', 'success', 'failed'] — 
    - address*: string — 
    - currency*: string — Pix settles in BRL only
    - amount*: string nullable — Total in the currency the payout settles from, not BRL. What actually leaves each balance is in `debits`
    - fee*: string nullable — Payout fee, followed by its currency when known
    - exchangeRate*:  nullable — Rate between the currency the payout settles from and BRL, e.g. 1 USDT ≈ 5.40 BRL. Null when loki does not price it or both sides are the same money (BRAt and BRL)
      allOf:
        - base*: string — Currency of the "1" side, the larger unit
        - quote*: string — Currency the rate is expressed in
        - rate*: string — How much `quote` one `base` is worth
    - expiresAt*: string nullable — Quote expiry (ISO 8601)
    - debits*: array — What the payout takes out of each balance, one entry per currency — more than one when it is funded from several balances. Empty when it is not known.
      - currency*: string — Balance the funds are taken from
      - amount*: string — Amount taken from that balance, fee and taxes included
  RESP 401: Missing or insufficient credentials
  RESP 403: Pix payout not enabled for the organization, no pix rail available, or terms not accepted
  RESP 422: Insufficient funds, invalid pix key or limit exceeded
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error
  RESP 503: The pix rail is temporarily cut

### PUT /api/v1/pix/payouts/confirm/{id} — Confirm a pix payout
Executes a previously previewed pix payout by its transaction id. Settlement is async, so the response returns a pending status. With a person credential nothing runs here: the person confirms the operation in belo, and repeating this call returns the result.
  param path:id* string  — 
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  param header:X-Belo-Human-Confirmed string  — Only read for a person credential while the approval flow is switched off: `true` once the person confirmed the operation to the caller. Any other value counts as absent.
  RESP 200: Confirmed pix payout
    - id*: string [uuid] — Transaction id
    - status*: string enum=['pending', 'success', 'failed'] — Settlement is async — a confirmed payout starts as pending
  RESP 401: Missing or insufficient credentials
  RESP 403: approval_required: a person credential has to confirm in belo first; `details` carries approvalId, approvalUrl and expiresAt. approval_denied: the person rejected it.
  RESP 404: Pix payout not found
  RESP 409: approval_expired, approval_conflict (another person, an API key on an operation with an approval, or already confirmed elsewhere), confirm_in_progress, request_in_progress, or human_confirmation_required (approvals switched off: confirm with the person and retry with X-Belo-Human-Confirmed: true)
  RESP 422: quote_expired: the preview has to be requested again; or the business rejection of the execution the person confirmed (e.g. insufficient_funds)
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error
  RESP 503: The pix rail is temporarily cut

### POST /api/v1/pix/payouts/terms — Accept the pix payout terms
Records that the organization accepted belo's pix payout terms of service. Required once before the first recipient lookup or payout preview; accepting again is a no-op.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - acceptedTerms*: boolean — Attestation that the organization accepted belo's pix payout terms of service, shown in your UI. Must be `true`.
  RESP 200: Terms accepted
    - acceptedTerms*: boolean — Whether the organization has accepted the pix payout terms
  RESP 401: Missing or insufficient credentials
  RESP 403: Pix payout not enabled for the organization or no pix rail available
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/cards — List the organization's cards
Returns every card of the organization, virtual and physical, with its status and whether it can be frozen right now. The list is not paginated.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Cards of the organization
    - data*: array — 
      - id*: string — Card id — use it to list its movements or to freeze and unfreeze it
      - name*: string nullable — Label given at creation
      - lastFour*: string nullable — Last four digits of the card number
      - brand*: string enum=['visa', 'mastercard', 'unknown'] — 
      - type*: string enum=['virtual', 'physical'] — The API only creates virtual cards; physical ones can still be listed
      - status*: string enum=['active', 'frozen', 'inactive', 'cancelled', 'unknown'] — `frozen` cards reject new charges until unfrozen. `unknown` is a provider status this API does not map yet.
      - canFreeze*: boolean — Whether the provider currently accepts a freeze or unfreeze for this card
  RESP 401: Missing or insufficient credentials
  RESP 403: Cards are not enabled for this organization
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/cards — Create a virtual card
Issues a new virtual card for the organization. Physical cards cannot be requested through the API. The provider caps the number of virtual cards and requires a minimum balance to issue one.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - name: string — Label for the card. The provider assigns one when omitted.
  RESP 201: Virtual card created
    - id*: string — Card id — use it to list its movements or to freeze and unfreeze it
    - name*: string nullable — Label given at creation
    - lastFour*: string nullable — Last four digits of the card number
    - brand*: string enum=['visa', 'mastercard', 'unknown'] — 
    - type*: string enum=['virtual', 'physical'] — The API only creates virtual cards; physical ones can still be listed
    - status*: string enum=['active', 'frozen', 'inactive', 'cancelled', 'unknown'] — `frozen` cards reject new charges until unfrozen. `unknown` is a provider status this API does not map yet.
    - canFreeze*: boolean — Whether the provider currently accepts a freeze or unfreeze for this card
  RESP 400: Invalid request body
  RESP 401: Missing or insufficient credentials
  RESP 403: Cards are not enabled for this organization
  RESP 422: Virtual card limit reached or insufficient balance
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/cards/application — Read the organization's card application
Returns where the organization stands with the card issuer. Cards can only be issued while the application is `approved`, so this is the endpoint that tells a `card_not_allowed` on card creation apart from an application that was never submitted, is still under review, or was rejected.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Card application
    - status*: string enum=['not_started', 'in_review', 'approved', 'rejected', 'unknown'] — Where the organization stands with the card issuer. Cards can only be issued while `approved`. `unknown` is an issuer status this API does not map yet.
    - acceptedTerms*: boolean — Whether the issuer's terms of service were accepted with the application. With `status: not_started` it is always `false` because no application was ever submitted — it is not a refusal of the terms.
  RESP 401: Missing or insufficient credentials
  RESP 403: Cards are not enabled for this organization
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/cards/application — Submit the card application
Submits the declared yearly income, the expected monthly card spend and the acceptance of the issuer terms. Review is asynchronous: the response carries the status the application starts at, and `GET /cards/application` reports the outcome. Once an application exists this endpoint returns it unchanged — it never resets a review.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - annualRevenue*: string enum=['from_0_to_5000', 'from_5000_to_10000', 'from_10000_to_20000', 'from_20000_to_50000', 'from_50000_to_100000', 'more_than_100000'] — Declared yearly income of the organization, as a bracket in USD.
    - monthlyCardSpend*: string enum=['from_0_to_500', 'from_500_to_1000', 'from_1000_to_5000', 'from_5000_to_10000', 'more_than_10000'] — Expected monthly spend across the organization's cards, as a bracket in USD.
    - acceptedTerms*: boolean — Attestation that the organization accepted the card issuer's terms of service, shown in your UI. Must be `true`.
  RESP 201: Card application
    - status*: string enum=['not_started', 'in_review', 'approved', 'rejected', 'unknown'] — Where the organization stands with the card issuer. Cards can only be issued while `approved`. `unknown` is an issuer status this API does not map yet.
    - acceptedTerms*: boolean — Whether the issuer's terms of service were accepted with the application. With `status: not_started` it is always `false` because no application was ever submitted — it is not a refusal of the terms.
  RESP 400: Invalid request body
  RESP 401: Missing or insufficient credentials
  RESP 403: Cards are not enabled for this organization
  RESP 409: The organization profile is missing data the card issuer requires
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/cards/{id}/transactions — List a card's movements
Returns the movements of a card, newest first. Card movements are not part of `GET /transactions`: this endpoint is the only place to read them.
  param path:id* string  — Card id
  param query:limit number  — Maximum number of items to return
  param query:page number  — Page number (1-indexed)
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Paginated card movements
    - data*: array — 
      - id*: string — Movement id
      - status*: string enum=['pending', 'success', 'failed'] — An authorization stays pending until it settles or is reversed
      - amount*: string — Amount as a decimal string, denominated in `currency`
      - currency*: string — Currency the amount is denominated in
      - description*: string nullable — Merchant or concept as the provider reports it
      - createdAt*: string [date-time] — 
    - pagination*: object — 
      - total: number — 
      - limit: number — 
      - currentPage: number — 
      - nextPage: number nullable — 
      - prevPage: number nullable — 
  RESP 400: Invalid query parameters
  RESP 401: Missing or insufficient credentials
  RESP 403: Cards are not enabled for this organization
  RESP 404: Card not found
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/cards/{id}/freeze — Freeze a card
Stops the card from accepting new charges until it is unfrozen. Returns the card with its refreshed status.
  param path:id* string  — Card id
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  RESP 200: Frozen card
    - id*: string — Card id — use it to list its movements or to freeze and unfreeze it
    - name*: string nullable — Label given at creation
    - lastFour*: string nullable — Last four digits of the card number
    - brand*: string enum=['visa', 'mastercard', 'unknown'] — 
    - type*: string enum=['virtual', 'physical'] — The API only creates virtual cards; physical ones can still be listed
    - status*: string enum=['active', 'frozen', 'inactive', 'cancelled', 'unknown'] — `frozen` cards reject new charges until unfrozen. `unknown` is a provider status this API does not map yet.
    - canFreeze*: boolean — Whether the provider currently accepts a freeze or unfreeze for this card
  RESP 401: Missing or insufficient credentials
  RESP 403: Cards are not enabled for this organization
  RESP 404: Card not found
  RESP 409: The card status does not allow freezing it
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/cards/{id}/unfreeze — Unfreeze a card
Lets a frozen card accept charges again. Returns the card with its refreshed status.
  param path:id* string  — Card id
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  RESP 200: Unfrozen card
    - id*: string — Card id — use it to list its movements or to freeze and unfreeze it
    - name*: string nullable — Label given at creation
    - lastFour*: string nullable — Last four digits of the card number
    - brand*: string enum=['visa', 'mastercard', 'unknown'] — 
    - type*: string enum=['virtual', 'physical'] — The API only creates virtual cards; physical ones can still be listed
    - status*: string enum=['active', 'frozen', 'inactive', 'cancelled', 'unknown'] — `frozen` cards reject new charges until unfrozen. `unknown` is a provider status this API does not map yet.
    - canFreeze*: boolean — Whether the provider currently accepts a freeze or unfreeze for this card
  RESP 401: Missing or insufficient credentials
  RESP 403: Cards are not enabled for this organization
  RESP 404: Card not found
  RESP 409: The card status does not allow unfreezing it
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/contacts — List the organization's contacts
Returns the address book: own accounts first, then favorites, then the contacts transferred to most recently. Capped at the 30 most relevant contacts; use `search` to reach the rest. An address of a type the transfer endpoints accept can be the destination of a transfer as is.
  param query:addressType string ['BELOTAG', 'CBU', 'CVU', 'ALIAS', 'CBU_USD', 'ALIAS_USD', 'BANK_ACCOUNT', 'PIX', 'BREB', 'ACH', 'SEPA', 'INTERNATIONAL_ACCOUNT', 'BITCOIN', 'BITCOIN_P2PKH', 'BITCOIN_P2SH', 'BITCOIN_BECH32', 'BITCOIN_LIGHTNING', 'ETHEREUM', 'ETHEREUM_ENS', 'TRON', 'POLYGON', 'OPTIMISM', 'ARBITRUM_ONE', 'BSC', 'STELLAR', 'SOLANA', 'BASE', 'AVALANCHE', 'PLASMA'] — Only contacts with at least one address of this type
  param query:search string  — Search by contact name or nickname
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Contacts of the organization
    - data*: array — 
      - id*: string — Contact id
      - name*: string nullable — 
      - nickname*: string nullable — Nickname given by the user
      - belotag*: string nullable — belo username when the contact is a belo user
      - isFavorite*: boolean — 
      - tier*: string enum=['self', 'favorite', 'frequent', 'unknown'] — Group the contact is ranked in: `self` (own accounts), `favorite`, `frequent`. `unknown` when the address book is not ranked.
      - lastTransferAt*: string nullable — Last transfer to this contact (ISO 8601)
      - accounts*: array — 
        - currency*: string nullable — Currency code of the account
        - ownerName*: string nullable — Account holder name as the bank reports it
        - addresses*: array — 
  RESP 400: Invalid query parameters
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/contacts/{id} — Get a contact
Returns one contact of the address book with all its accounts.
  param path:id* string  — Contact id
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Contact
    - id*: string — Contact id
    - name*: string nullable — 
    - nickname*: string nullable — Nickname given by the user
    - belotag*: string nullable — belo username when the contact is a belo user
    - isFavorite*: boolean — 
    - tier*: string enum=['self', 'favorite', 'frequent', 'unknown'] — Group the contact is ranked in: `self` (own accounts), `favorite`, `frequent`. `unknown` when the address book is not ranked.
    - lastTransferAt*: string nullable — Last transfer to this contact (ISO 8601)
    - accounts*: array — 
      - currency*: string nullable — Currency code of the account
      - ownerName*: string nullable — Account holder name as the bank reports it
      - addresses*: array — 
        - addressType*: string — Address type, in the same vocabulary as the transfer endpoints (`CBU`, `ALIAS`, `PIX`, `BELOTAG`, a crypto network...)
        - address*: string — The address itself: a CBU, alias, pix key, belotag, wallet...
        - network*: string nullable — Network of a crypto address
        - country*: string nullable — Destination country of an international account
        - fields*: array — Beneficiary data of an international account; empty for any other address
  RESP 401: Missing or insufficient credentials
  RESP 404: Contact not found
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/vaults — List the organization's vaults
Returns every savings vault of the organization with its balance and yield rate. Limited to one call per second per organization: on `429`, wait the `Retry-After` seconds before retrying.
  param query:currencyCode string  — Only vaults in this currency. An unknown code returns an empty list.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Vaults of the organization
    - data*: array — 
      - id*: string — Vault id
      - currencyCode*: string — Currency code of the vault
      - details*: object — 
        - name*: string — Name the organization gave the vault
        - icon*: string nullable — Icon identifier
        - cover*: string nullable — Cover image URL
        - description*: string nullable — Free-text description
        - goalAmount*: string nullable — Savings goal as a decimal string in the vault currency
      - balance*: string — Current balance as a decimal string
      - isYieldActive*: boolean — Whether the vault is accruing yield right now
      - rate*: string — Annual rate the yield engine applies to the vault, as a percentage string. `"0.00%"` when the currency pays no yield.
  RESP 400: Invalid query parameters
  RESP 401: Missing or insufficient credentials
  RESP 429: Rate limit exceeded
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/vaults/{id} — Get a vault
Returns one vault with its balance, yield rate and the yield it accrued.
  param path:id* string  — Vault id
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Vault
    - id*: string — Vault id
    - currencyCode*: string — Currency code of the vault
    - details*: object — 
      - name*: string — Name the organization gave the vault
      - icon*: string nullable — Icon identifier
      - cover*: string nullable — Cover image URL
      - description*: string nullable — Free-text description
      - goalAmount*: string nullable — Savings goal as a decimal string in the vault currency
    - balance*: string — Current balance as a decimal string
    - isYieldActive*: boolean — Whether the vault is accruing yield right now
    - rate*: string — Annual rate the yield engine applies to the vault, as a percentage string. `"0.00%"` when the currency pays no yield.
    - earned*:  — Yield the vault already accrued, per window. Always present, zeroed when none.
      allOf:
        - total*: string — Lifetime accrued yield, as a decimal string
        - today*: string — Accrued today
        - yesterday*: string — Accrued yesterday
        - week*: string — Accrued this week
        - month*: string — Accrued this month
        - year*: string — Accrued this year
  RESP 401: Missing or insufficient credentials
  RESP 404: Vault not found
  RESP 429: Rate limit exceeded
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/end-users — Register an end user
Creates a belo account for the end user under your organization and returns it with `kyc.status: pending` and the data still to send in `pendingData`. First have the end user accept belo's terms on the hosted page (`POST /terms/links`) and send the `signedAgreementId` it hands back; each id registers one end user. Which declarations are required depends on the country (AR: all three; BR: `pep` and `usTaxResident`). If the email already belongs to a belo user, that user is linked to your organization instead (`existingAccount: true`): you can read their KYC status and start KYC, but not see or update their data.
  param header:idempotency-key* string  — 
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - email*: string — Email of the end user
    - country*: string — Country of residence, ISO 3166-1 alpha-2. Only countries enabled for the API are accepted (AR and BR today).
    - documentNumber*: string — National identity document number, as the app asks at sign-up: DNI (7 or 8 digits) for Argentina, CPF (11 digits, check digits verified) for Brazil. Digits only, no mask.
    - externalReference: string — Your own identifier for this end user. Unique within your organization.
    - signedAgreementId*: string [uuid] — Proof that the end user accepted belo's terms: the id the hosted acceptance page handed back (`POST /terms/links`). It must belong to your organization and to the same country, be used within 24 h of the acceptance, and registers a single end user.
    - declarations*: object — 
      - pep: boolean — The end user is a politically exposed person (PEP): holds a public office or is a relative of someone who does. Required in AR and BR.
      - obligatedSubject: boolean — The end user is an obligated subject (sujeto obligado) under local AML rules: their profession or usual activity is exposed to money laundering. Required in AR.
      - usTaxResident: boolean — The end user is a US tax resident (FATCA): green card or substantial presence, i.e. more than 6 months in the US during the fiscal year. Required in AR and BR.
  RESP 201: End user registered or linked
    - id*: string [uuid] — End user id
    - externalReference*: string nullable — Your own identifier
    - email*: string — 
    - country*: string — ISO 3166-1 alpha-2
    - existingAccount*: boolean — True when the email already belonged to a belo user before you registered them. Their data is not visible and cannot be changed through this API; KYC status and sessions work.
    - kyc*: object — 
      - status*: string enum=['pending', 'in_review', 'verified', 'recheck_required', 'rejected', 'blocked'] — 
      - reason*: string nullable — Machine-readable reason for the current status. For `rejected`: `RETRY` means the end user can resubmit through a new KYC session, `FINAL` that they cannot, `DUPLICATE` that the document already belongs to another belo account, and `UNDERAGE` that the document shows a minor.
      - updatedAt*: string [date-time] nullable — Last status change
    - terms*: object — 
      - accepted*: boolean — Whether the end user accepted belo's terms
      - acceptedAt*: string [date-time] nullable — When the end user accepted on the hosted page. Null only for end users registered before the hosted acceptance existed.
    - createdAt*: string [date-time] — 
    - pendingData*: array — What is still missing before the KYC can start; send it with `PATCH /end-users/:id`. Empty means a KYC session can be created.
    - declarations*:  nullable — 
      allOf:
        - pep*: boolean nullable — Politically exposed person
        - obligatedSubject*: boolean nullable — Obligated subject under local AML rules
        - usTaxResident*: boolean nullable — US tax resident (FATCA)
    - personalData*:  nullable — 
      allOf:
        - occupation*: string enum=['company_director', 'company_shareholder', 'freelancer', 'employee', 'income_earner', 'informal_employee', 'retired', 'self_employee', 'student', 'unemployed', 'public_official'] nullable — 
        - civilStatus*: string enum=['single', 'married', 'widower', 'divorced'] nullable — 
        - annualSalary*: string enum=['from_0_to_5000', 'from_5000_to_10000', 'from_10000_to_20000', 'from_20000_to_50000', 'from_50000_to_100000', 'more_than_100000'] nullable — 
        - phone*:  nullable — 
          allOf:
            - number*: string — E.164
            - country*: string — ISO 3166-1 alpha-2
        - address*:  nullable — 
          allOf:
            - streetName*: string — 
            - streetNumber*: string — 
            - floor*: string nullable — 
            - apartment*: string nullable — 
            - zipCode*: string — 
            - city*: string — 
            - region*: string — 
            - additionalInfo*: string nullable — 
  RESP 400: Invalid request, missing Idempotency-Key, country not enabled, or a required declaration missing
  RESP 401: Missing or insufficient credentials
  RESP 409: Email or externalReference already registered in your organization, the belo user is linked to another partner, the end user is not eligible (PEP, US tax resident, document owned by another belo account), or the signedAgreementId is not valid for this registration (`terms_agreement_invalid`)
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/end-users — List the organization's end users
Returns the end users registered through the API, newest first, paginated with `page`/`limit`. Optionally filter by `externalReference` (exact match) or `kycStatus`. Items carry the summary shape; fetch `GET /end-users/:id` for pending data, declarations and personal data.
  param query:limit number  — Maximum number of items to return
  param query:page number  — Page number (1-indexed)
  param query:externalReference string  — Exact match on your own identifier
  param query:kycStatus string ['pending', 'in_review', 'verified', 'recheck_required', 'rejected', 'blocked'] — Filter by KYC status
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Paginated end users
    - data*: array — 
      - id*: string [uuid] — End user id
      - externalReference*: string nullable — Your own identifier
      - email*: string — 
      - country*: string — ISO 3166-1 alpha-2
      - existingAccount*: boolean — True when the email already belonged to a belo user before you registered them. Their data is not visible and cannot be changed through this API; KYC status and sessions work.
      - kyc*: object — 
        - status*: string enum=['pending', 'in_review', 'verified', 'recheck_required', 'rejected', 'blocked'] — 
        - reason*: string nullable — Machine-readable reason for the current status. For `rejected`: `RETRY` means the end user can resubmit through a new KYC session, `FINAL` that they cannot, `DUPLICATE` that the document already belongs to another belo account, and `UNDERAGE` that the document shows a minor.
        - updatedAt*: string [date-time] nullable — Last status change
      - terms*: object — 
        - accepted*: boolean — Whether the end user accepted belo's terms
        - acceptedAt*: string [date-time] nullable — When the end user accepted on the hosted page. Null only for end users registered before the hosted acceptance existed.
      - createdAt*: string [date-time] — 
    - pagination*: object — 
      - total: number — 
      - limit: number — 
      - currentPage: number — 
      - nextPage: number nullable — 
      - prevPage: number nullable — 
  RESP 400: Invalid query parameters
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/end-users/{id} — Get an end user
Returns the end user with a fresh `kyc.status`, the data still pending before the KYC and the data submitted so far. This endpoint is the source of truth for the KYC status; the `end_user.kyc.updated` webhook is a best-effort notification.
  param path:id* string  — End user id returned on registration
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: End user
    - id*: string [uuid] — End user id
    - externalReference*: string nullable — Your own identifier
    - email*: string — 
    - country*: string — ISO 3166-1 alpha-2
    - existingAccount*: boolean — True when the email already belonged to a belo user before you registered them. Their data is not visible and cannot be changed through this API; KYC status and sessions work.
    - kyc*: object — 
      - status*: string enum=['pending', 'in_review', 'verified', 'recheck_required', 'rejected', 'blocked'] — 
      - reason*: string nullable — Machine-readable reason for the current status. For `rejected`: `RETRY` means the end user can resubmit through a new KYC session, `FINAL` that they cannot, `DUPLICATE` that the document already belongs to another belo account, and `UNDERAGE` that the document shows a minor.
      - updatedAt*: string [date-time] nullable — Last status change
    - terms*: object — 
      - accepted*: boolean — Whether the end user accepted belo's terms
      - acceptedAt*: string [date-time] nullable — When the end user accepted on the hosted page. Null only for end users registered before the hosted acceptance existed.
    - createdAt*: string [date-time] — 
    - pendingData*: array — What is still missing before the KYC can start; send it with `PATCH /end-users/:id`. Empty means a KYC session can be created.
    - declarations*:  nullable — 
      allOf:
        - pep*: boolean nullable — Politically exposed person
        - obligatedSubject*: boolean nullable — Obligated subject under local AML rules
        - usTaxResident*: boolean nullable — US tax resident (FATCA)
    - personalData*:  nullable — 
      allOf:
        - occupation*: string enum=['company_director', 'company_shareholder', 'freelancer', 'employee', 'income_earner', 'informal_employee', 'retired', 'self_employee', 'student', 'unemployed', 'public_official'] nullable — 
        - civilStatus*: string enum=['single', 'married', 'widower', 'divorced'] nullable — 
        - annualSalary*: string enum=['from_0_to_5000', 'from_5000_to_10000', 'from_10000_to_20000', 'from_20000_to_50000', 'from_50000_to_100000', 'more_than_100000'] nullable — 
        - phone*:  nullable — 
          allOf:
            - number*: string — E.164
            - country*: string — ISO 3166-1 alpha-2
        - address*:  nullable — 
          allOf:
            - streetName*: string — 
            - streetNumber*: string — 
            - floor*: string nullable — 
            - apartment*: string nullable — 
            - zipCode*: string — 
            - city*: string — 
            - region*: string — 
            - additionalInfo*: string nullable — 
  RESP 400: Invalid end user id
  RESP 401: Missing or insufficient credentials
  RESP 404: End user not found
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### PATCH /api/v1/end-users/{id} — Submit onboarding data for an end user
Partial update: send only the fields you collected; omitted fields are left untouched and at least one field is required. `pendingData` on `GET /end-users/:id` lists what is still needed: `occupation`, `address` and `phone` (plus any missing declaration). `civilStatus` and `annualSalary` are optional. Sex and nationality are taken from the identity document during KYC and cannot be set here. End users with an existing belo account cannot be updated.
  param path:id* string  — End user id returned on registration
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - occupation: string enum=['company_director', 'company_shareholder', 'freelancer', 'employee', 'income_earner', 'informal_employee', 'retired', 'self_employee', 'student', 'unemployed', 'public_official'] — 
    - civilStatus: string enum=['single', 'married', 'widower', 'divorced'] — Collected in Argentina only
    - annualSalary: string enum=['from_0_to_5000', 'from_5000_to_10000', 'from_10000_to_20000', 'from_20000_to_50000', 'from_50000_to_100000', 'more_than_100000'] — Yearly income range in USD. Not collected in Argentina or Brazil.
    - declarations: object — 
      - pep: boolean — The end user is a politically exposed person (PEP): holds a public office or is a relative of someone who does. Required in AR and BR.
      - obligatedSubject: boolean — The end user is an obligated subject (sujeto obligado) under local AML rules: their profession or usual activity is exposed to money laundering. Required in AR.
      - usTaxResident: boolean — The end user is a US tax resident (FATCA): green card or substantial presence, i.e. more than 6 months in the US during the fiscal year. Required in AR and BR.
    - phone: object — 
      - number*: string — Full number in E.164 format, including the leading `+`
      - country*: string — Country the number belongs to, ISO 3166-1 alpha-2. Must match the number.
    - address:  — Main (home) address
      allOf:
        - streetName*: string — 
        - streetNumber*: string — 
        - floor: string — Not collected in Brazil
        - apartment: string — 
        - zipCode*: string — Argentina: 3 to 8 letters or digits, no hyphen (`C1043AAZ`). Brazil: CEP as `00000-000`.
        - city*: string — 
        - region*: string — Province or state name as belo lists it: one of the 24 Argentine provinces (`Ciudad Autónoma de Buenos Aires`, `Córdoba`, …) or the 27 Brazilian states (`São Paulo`, `Minas Gerais`, …). Validated against the end user country.
        - additionalInfo: string — Not collected in Brazil
  RESP 200: End user with the refreshed data
    - id*: string [uuid] — End user id
    - externalReference*: string nullable — Your own identifier
    - email*: string — 
    - country*: string — ISO 3166-1 alpha-2
    - existingAccount*: boolean — True when the email already belonged to a belo user before you registered them. Their data is not visible and cannot be changed through this API; KYC status and sessions work.
    - kyc*: object — 
      - status*: string enum=['pending', 'in_review', 'verified', 'recheck_required', 'rejected', 'blocked'] — 
      - reason*: string nullable — Machine-readable reason for the current status. For `rejected`: `RETRY` means the end user can resubmit through a new KYC session, `FINAL` that they cannot, `DUPLICATE` that the document already belongs to another belo account, and `UNDERAGE` that the document shows a minor.
      - updatedAt*: string [date-time] nullable — Last status change
    - terms*: object — 
      - accepted*: boolean — Whether the end user accepted belo's terms
      - acceptedAt*: string [date-time] nullable — When the end user accepted on the hosted page. Null only for end users registered before the hosted acceptance existed.
    - createdAt*: string [date-time] — 
    - pendingData*: array — What is still missing before the KYC can start; send it with `PATCH /end-users/:id`. Empty means a KYC session can be created.
    - declarations*:  nullable — 
      allOf:
        - pep*: boolean nullable — Politically exposed person
        - obligatedSubject*: boolean nullable — Obligated subject under local AML rules
        - usTaxResident*: boolean nullable — US tax resident (FATCA)
    - personalData*:  nullable — 
      allOf:
        - occupation*: string enum=['company_director', 'company_shareholder', 'freelancer', 'employee', 'income_earner', 'informal_employee', 'retired', 'self_employee', 'student', 'unemployed', 'public_official'] nullable — 
        - civilStatus*: string enum=['single', 'married', 'widower', 'divorced'] nullable — 
        - annualSalary*: string enum=['from_0_to_5000', 'from_5000_to_10000', 'from_10000_to_20000', 'from_20000_to_50000', 'from_50000_to_100000', 'more_than_100000'] nullable — 
        - phone*:  nullable — 
          allOf:
            - number*: string — E.164
            - country*: string — ISO 3166-1 alpha-2
        - address*:  nullable — 
          allOf:
            - streetName*: string — 
            - streetNumber*: string — 
            - floor*: string nullable — 
            - apartment*: string nullable — 
            - zipCode*: string — 
            - city*: string — 
            - region*: string — 
            - additionalInfo*: string nullable — 
  RESP 400: Invalid request, missing Idempotency-Key, empty body, invalid phone, or a region outside the end user country list
  RESP 401: Missing or insufficient credentials
  RESP 404: End user not found
  RESP 409: Existing belo account: data is read-only through the API
  RESP 422: Address rejected by the country rules
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/end-users/{id}/kyc/sessions — Start a KYC verification
Returns a hosted verification link (`mode: url`) to open for the end user, reusable until `expiresAt`; call again with a new `Idempotency-Key` to get a fresh one. The redirect URLs fire when the end user submits, not when the verification is decided: treat the redirect as "submitted" and read the outcome from `GET /end-users/:id` or the `end_user.kyc.updated` webhook. `rejectUrl` needs `redirectUrl`. Requires `pendingData` to be empty. Only `pending` and retryable `rejected` users can start a session.
  param path:id* string  — End user id returned on registration
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - redirectUrl: string — Where the end user is sent after submitting the verification (https). Required when `rejectUrl` is set.
    - rejectUrl: string — Where the end user is sent if the submission cannot be completed (https). Only with `redirectUrl`.
    - locale: string — UI language, ISO 639-1
    - ttlSeconds: number — Link lifetime in seconds
  RESP 201: Verification session
    - mode*: string enum=['url'] — 
    - url*: string — Hosted verification URL to open for the end user. Reusable until it expires.
    - expiresAt*: string [date-time] — When the link stops working
  RESP 400: Invalid request, missing Idempotency-Key, or rejectUrl without redirectUrl
  RESP 401: Missing or insufficient credentials
  RESP 404: End user not found
  RESP 409: The end user still has pending data, or the current KYC status does not allow a new session
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### GET /api/v1/terms — List belo's legal documents for a country
Returns the documents the hosted acceptance page shows to an end user of that country (terms and conditions, risk disclosure, privacy policy), in its language, so you can link them from your own app. Acceptance itself happens on the hosted page.
  param query:country* string  — Country of the end user, ISO 3166-1 alpha-2
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  RESP 200: Legal documents
    - data*: array — 
      - type*: string enum=['terms_and_conditions', 'risk_disclosure', 'privacy_policy'] — 
      - title*: string — Title in the language of the country
      - url*: string — 
  RESP 400: Invalid or not enabled country
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

### POST /api/v1/terms/links — Create a terms acceptance link
Returns a hosted page where the end user reads and accepts belo's terms, valid for 30 minutes. Open it in an iframe, a WebView or a new tab. On acceptance you receive a `signedAgreementId`: by redirect to `redirectUri` (query `signed_agreement_id`) when set, otherwise by `postMessage` `{ type: "belo.terms.accepted", signedAgreementId }` to the origins allowlisted for your organization. The id is single-use and identifies the acceptance when registering the end user. Each link needs a new `Idempotency-Key`.
  param header:Authorization* string  — API key in the form `ApiKey belo_live_<token>`.
  param header:Idempotency-Key* string  — Idempotency key
  BODY:
    - country*: string — Country of the end user, ISO 3166-1 alpha-2. Decides the documents and the language.
    - redirectUri: string — Where the end user is sent after accepting, with `signed_agreement_id` appended as a query parameter. An absolute URL whose origin is in your organization allowlist. Without it the id is delivered by `postMessage` to the allowlisted origins, so the page must be embedded.
  RESP 201: Acceptance link
    - url*: string — Hosted acceptance page to open for the end user (iframe, WebView or new tab)
    - expiresAt*: string [date-time] — When the link stops opening
  RESP 400: Invalid request, missing Idempotency-Key, country not enabled, redirectUri outside the allowlist, or no redirectUri while the organization has no allowlisted origins
  RESP 401: Missing or insufficient credentials
  RESP 500: Unexpected internal error
  RESP 502: Upstream provider error

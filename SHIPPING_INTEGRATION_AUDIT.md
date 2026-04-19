# Shipping Calculation Integration Audit

## Scope
Audit target: `/api/shipping/cost` backend response and checkout frontend shipping state update.

## Backend findings

1. **Endpoint and payload**
   - Route is `POST /api/shipping/cost`.
   - Frontend sends payload:
     ```json
     {
       "weight": <Alpine.store('cart').totalWeight>
     }
     ```

2. **Response shape**
   - Backend returns:
     ```json
     {
       "status": "success",
       "origin": {
         "district": "Turen",
         "regency": "Kabupaten Malang",
         "province": "Jawa Timur"
       },
       "recommendation": {
         "code": "rekomendasi-kami",
         "label": "Rekomendasi Kami",
         "badge": "Direkomendasikan",
         "zone_name": "<matched zone>",
         "base_rate": <number>,
         "extra_per_kg": <number>,
         "weight_kg": <number>,
         "cost": <number>,
         "etd": "1-4 hari kerja"
       }
     }
     ```

3. **Returned field names relevant to cost**
   - Present in response: `recommendation.cost`
   - Not present as top-level aliases: `shippingCost`, `cost`, `total_cost`

4. **Weight handling and calculation logic**
   - Incoming `weight` is interpreted as grams and converted to kg by:
     - `Math.ceil(weight / 1000)`
     - minimum enforced to `1` kg.
   - Shipping cost is computed as:
     - `base_rate + (max(weight_kg - 1, 0) * extra_per_kg)`

5. **Non-zero validation**
   - Code logic allows non-zero cost, but **actual runtime value depends on DB data** (`shipping_rates.base_rate` and `shipping_rates.extra_per_kg`).
   - Schema defaults both fields to `0`, so if admin config remains default, computed `recommendation.cost` will be `0`.

## Frontend findings

6. **Response mapping in `calculateShipping()`**
   - Frontend reads `result.recommendation`.
   - Zone and estimate labels are set from `recommendation.zone_name` and `recommendation.etd`.
   - Shipping value assignment is:
     - `this.updateShippingCost(recommendation.cost || 0)`

7. **Exact field used to set shipping state**
   - `this.shipping.cost` is updated via `updateShippingCost(cost)`.
   - Source field is exactly `recommendation.cost`.

8. **UI refresh trigger**
   - Shipping UI binding uses Alpine reactive expressions:
     - shipping line: `window.formatRupiah(ongkir)`
     - total line: `window.formatRupiah(calculateGrandTotal())`
   - `ongkir` getter returns `Number(this.shipping.cost || 0)`, so any non-zero state update should auto-refresh summary UI.

9. **Total payment recalculation**
   - Grand total formula is `subtotal + ppnAmount + ongkir`.
   - Therefore total payment recalculates automatically when `shipping.cost` changes.

## Why checkout still shows Rp 0

Most likely cause from this audit:

1. **Backend returns cost as zero** because matched shipping rate has `base_rate = 0` and `extra_per_kg = 0` (schema defaults), even though API now responds successfully.
2. **No field-name mismatch between backend and frontend** in current codepath; frontend expects `recommendation.cost`, and backend provides it.
3. If backend response changed elsewhere to top-level fields like `shippingCost`/`total_cost`, current frontend would ignore those and fallback to `0` due `recommendation.cost || 0`.

## Requested report items

- **Request payload**: `{ "weight": Alpine.store('cart').totalWeight }`
- **Response JSON**: nested `recommendation.cost` response (see shape above)
- **Frontend mapped field**: `result.recommendation.cost`
- **Reason UI still shows 0**: mapped field is correct, but calculated/backend value likely still `0` (rate config default zero), and frontend fallback `|| 0` keeps display at Rp 0.

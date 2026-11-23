# PlantX redesign: review checklist before anything is published

Status of the design: **preview only**. Nothing here is connected to Shopify, and nothing has been published to plantx-egypt.com.
Use this list to sign off (or remove) every number and claim. "Source" says where each item came from.

## A. For the agronomist (agronomic claims)

| # | Where | What the page says or does | Source | Needs |
|---|---|---|---|---|
| A1 | Home (Crop Management stage), Greenhouse and Crop Management pages | VPD "typical range": tomato 0.8 to 1.2 kPa, strawberry and lettuce 0.6 to 1.0 kPa (drives gauge colours and plant wilting) | General rule of thumb written by the designer. Not from a reviewed source for PlantX crops | Confirm or replace per crop, variety and growth stage, or remove the colour bands |
| A2 | Simulation panel | Feed setpoints EC 2.0 mS/cm and pH 5.8, with small oscillation while irrigating | Generic illustrative values. Not tied to the selected crop | Confirm, replace per crop and stage, or hide the numbers |
| A3 | Simulation | Controller rules: shade above about 26 C, vents when humid, misting when VPD above range, heating below 18 C | Designer's simplified rule set, tuned in an offline simulation | Confirm the logic is sensible. It is an illustration, not a control system |
| A4 | Simulation | Thermal model constants (solar gain, vent and fog effects) | Designer's simplified first-order model | Confirm it does not mislead. It is labelled "simplified model" in the UI |
| A5 | Home, last stage | "Recommended for your crop": tomato -> Fruit, strawberry -> Berry, lettuce -> Leafy and Lettuce A&B | Mapped from product and collection names and descriptions on plantx-egypt.com | Confirm the mapping |
| A6 | Home | Stage story: roots = hydroponics, feed = nutrition, crop = crop management, harvest = consultancy | Narrative choice by the designer | Confirm the mapping is acceptable |
| A7 | Plant drawings | Tomato, strawberry and lettuce are stylised drawings (not botanically exact) | Designer | Confirm they are acceptable, or supply photos |
| A8 | Messages in the simulation | "Humid air: transpiration slows and fungal disease risk rises", "Dry air: the crop loses water faster and growth can slow" | General plant physiology wording | Confirm wording |

## B. For the business owner (facts and numbers)

| # | Item | State |
|---|---|---|
| B1 | Proof numbers shown (5 services, 5 product lines, 3 marketplaces, 5.0 rating from 5 reviews) | Real, taken from plantx-egypt.com on the build date. Re-check before publishing |
| B2 | Project photos and facts | **Photos: done.** The Projects page and the strips on the service pages use the 21 photos from plantx-egypt.com/pages/projects (12 Saudi Arabia, 9 Egypt), labelled only by country. **Facts still missing:** project names, locations, areas, systems and results are not written anywhere. Send them to add a full page per project. Confirm you are happy to show these photos (they carry the PlantX watermark) |
| B3 | Years of experience, number of greenhouses, hectares, governorates | **Not provided and not written anywhere.** Send real figures if you want them shown |
| B4 | Prices (199.99 EGP, old price 220.00 EGP) | Copied from the store on the build date. Must match the store at publish time |
| B5 | Customer reviews (5 on the store) | Real quotes with the store names. Ask permission before showing names beyond the store |
| B6 | WhatsApp number | **Done.** +20 103 600 4753, read from the wa.link short link used on plantx-egypt.com (it redirects to api.whatsapp.com/send?phone=201036004753). The consultation form opens wa.me with the message pre-filled. Confirm this is the number you want customers to use |
| B7 | Email and phone for the contact page | Not provided |
| B8 | Instagram posts on the Knowledge page | Real posts, listed by their public URLs, with the first words of each caption. Check that you are happy to feature them |

## C. Translation

All Arabic text was written by the designer (English service text is from plantx-egypt.com). Please have a native speaker review every Arabic string, especially: service descriptions, process steps, simulation messages, form labels and the privacy notice on the consultation page.

## D. Technical items before launch

| # | Item | State |
|---|---|---|
| D1 | Search visibility | Added: crawlable text copy of the home page content, titles and descriptions, Open Graph tags and Organization data (name, logo, social links only). Still needed: real address and phone in the Organization data, a sitemap, and testing in Search Console after launch |
| D2 | Performance on weak phones | Added: lite mode (automatic when reduced motion is set, 2 CPU cores or less, or 2 GB memory or less; or add `?lite=1`). Tested only in desktop Chromium. A real low-end phone test is still needed |
| D3 | Fonts | Loaded from Google Fonts in this preview. For production, host the font files yourself |
| D4 | Logo | Shown in its original colours, directly on the dark scene. The small tagline under the logo is dim on dark backgrounds. A light version of the logo would fix this |
| D5 | Forms | The consultation form sends nothing to a server. It prepares a message to copy or open in WhatsApp. A real submission needs a backend or the store platform |
| D6 | Accessibility | Keyboard focus is visible and reduced-motion is respected for the scene. Not yet tested with a screen reader |
| D7 | Browsers | Tested in Chromium only. Safari and Firefox are not tested |
| D8 | Shopify decision | Deliberately **not** part of this round. No store, cart or product pages are changed |

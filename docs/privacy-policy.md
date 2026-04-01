# SolarSnap Privacy Policy

> **Note for the developer:** This policy is a plain-English draft intended to accurately describe how SolarSnap works. It should be reviewed by a solicitor before the app goes live, particularly to ensure it meets UK GDPR requirements in full. The solicitor review is listed as a manual task in the pre-submission checklist.

**Last updated:** April 2026
**Applies to:** SolarSnap iOS and Android app
**Data controller:** [Your name / company name], reachable at hello@solarsnap.co.uk

---

## What is SolarSnap?

SolarSnap is a mobile app that helps homeowners find out whether their home is a good candidate for plug-in solar panels. You point your phone at the sky, take a photo, and the app tells you how much sunlight the spot receives and, for Premium users, how much energy a panel there might generate over a year.

---

## What information we collect

We collect only what is necessary to make the app work.

### Your email address
When you create a SolarSnap account, you provide an email address and a password. We use this only to identify your account and let you sign back in. We do not use it for marketing without your explicit consent.

### Your home GPS location (one coordinate)
On first sign-in you are asked to set a "home location" — a single GPS coordinate (latitude and longitude) for your property. This is stored against your account.

**Why we need it:** SolarSnap's personal licence allows assessments only within approximately 200 metres of your registered home. The app checks your current GPS position against this stored coordinate each time you run an assessment to enforce that boundary. Without it, the boundary check cannot work.

**What it is not used for:** We do not track your movements. We do not log every GPS reading your device takes. Only the one coordinate you deliberately register is stored.

### Assessment results
The app calculates a solar suitability score using your device's GPS, compass, and camera. These calculations happen on your device and on third-party services (described below). We do not permanently store your assessment results or photos.

### Payment information
Purchases are handled entirely by Apple (App Store) or Google (Google Play). SolarSnap never sees or stores your payment card details. After a purchase is confirmed we receive only a receipt token, which we verify with Apple or Google to confirm the transaction is genuine and to update your account tier.

---

## Third-party services we use

### Supabase
Your email address, home GPS coordinate, assessment credit balance, and licence tier are stored in a database managed by Supabase (supabase.com). Supabase is our hosting and authentication provider. Data is stored on servers within the European Economic Area. You can read Supabase's own privacy policy at supabase.com/privacy.

### Hugging Face
For sky obstruction analysis, a photograph taken during an assessment is sent to a model hosted on Hugging Face (huggingface.co). The photo is processed to identify buildings, trees, and other objects that may shade the panel. We do not store the photo after the analysis is complete. Hugging Face's privacy policy is at huggingface.co/privacy.

### PVGIS (EU Joint Research Centre)
For Premium users, your GPS coordinates and panel orientation are sent to the PVGIS API, a free public service run by the EU Joint Research Centre. This returns an estimated annual energy yield. No personal data other than approximate location is sent. The PVGIS service is operated by the European Commission.

---

## How long we keep your data

Your account data (email, home location, licence tier) is kept for as long as your account exists.

If you delete your account, all your data is deleted from our database within 30 days.

---

## Who we share your data with

We do not sell your data. We do not share it with advertisers.

Data is shared only with the third-party services listed above and only to the extent needed to deliver the app's features (e.g. your GPS coordinate is sent to PVGIS to retrieve solar data; your photo is sent to Hugging Face for sky analysis).

---

## Advertising and analytics

SolarSnap does not display advertising. We do not currently use any analytics service. If analytics are added in a future update, this policy will be updated and you will be notified through the app before any data is collected.

---

## Your rights under UK GDPR

Because SolarSnap is based in the UK and its users are primarily in the UK, UK data protection law (UK GDPR) applies. Under that law you have the right to:

- **Access** the personal data we hold about you
- **Correct** inaccurate data (for example, updating your home location, which you can do in the Account screen at any time)
- **Delete** your data — to request deletion of your account and all associated data, email us at hello@solarsnap.co.uk
- **Portability** — to receive a copy of your data in a common format on request
- **Object** to processing — in practice the only personal data we process is what is strictly necessary to run the app

To exercise any of these rights, contact us at **hello@solarsnap.co.uk**.

If you are unhappy with how we handle your data you also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk.

---

## Children

SolarSnap is not directed at children under 13. We do not knowingly collect personal data from children.

---

## Changes to this policy

If we make significant changes to this policy we will update the "Last updated" date above and, where appropriate, notify you through the app.

---

## Contact

For any privacy-related questions or data requests:
**Email:** hello@solarsnap.co.uk
**Website:** https://solarsnap.co.uk

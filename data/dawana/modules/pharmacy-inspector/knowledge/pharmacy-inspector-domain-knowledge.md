# Pharmacy Inspector Module — Domain Knowledge

The Pharmacy Inspector is a **review role**, not a separate feature. The incident itself is a Pharmacy feature (raised by pharmacy staff); the inspector only reviews and rules on it. This module therefore has no feature page of its own — it documents how the inspector acts on incidents.

## Inspector responsibilities
- Reviews each incident submitted by pharmacy staff (Owner, Manager, Pharmacist).
- **Approves** or **Rejects** the incident — with options and comments that depend on the specific incident.
- Works from a **list of incidents** to review, each showing its status (Pending / Approved / Rejected) and any comments.

## Effect of the decision
- **Approved** — the reported items are permanently removed from pharmacy stock; the incident status becomes Approved and is reflected on the Masar dashboard.
- **Rejected** — the incident status becomes Rejected, stock is left unchanged, and a rejection reason/comment may be provided to the pharmacy.

> The incident workflow the inspector acts on lives in the **Incident** feature under the **Pharmacy** module.

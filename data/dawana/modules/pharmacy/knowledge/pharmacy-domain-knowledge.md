# Pharmacy Module — Domain Knowledge

The Pharmacy module covers the operations performed by pharmacy staff in the Dawana mobile app.

## Roles & responsibilities
- **Owner** — registers/onboards the pharmacy (Registration) and raises incidents.
- **Pharmacy Manager** — receives stock (New Stock), returns stock to the distributor (Return to Distributor), and raises incidents.
- **Pharmacist** — raises incidents.

## Features in this module
- **Registration** — pharmacy onboarding / account registration (Owner).
- **New Stock** — receiving new serialized stock into the pharmacy (Manager).
- **Return to Distributor** — returning stock to the distributor (Manager).
- **Incident** — raising and managing incident reports for damaged / expired / stolen / lost stock (Owner, Manager, Pharmacist). Each incident is then reviewed by the pharmacy inspector, who approves or rejects it — see the **Pharmacy Inspector** module for that review role.

# Gasgo

Order cooking gas from nearby dealers and get it delivered to your door. Pay with M-Pesa.

## Structure
- `backend/`: Django + Django REST Framework + PostgreSQL (owner: Precious)
- `frontend/`: customer and dealer PWA (owner: partner)
- `docs/API.md`: the API contract both sides build against

## Backend setup
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then edit values
python manage.py makemigrations dealers orders
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```
Admin: http://127.0.0.1:8000/admin/

## Workflow
- `main` is always working. Never push directly to it.
- Branch per task: `backend/<task>` or `frontend/<task>`, then open a pull request.
- If an endpoint changes, update `docs/API.md` in the same PR.

## Order statuses
`placed` > `awaiting_dealer` > `accepted` > `paid` > `out_for_delivery` > `delivered`
Side exits: `rejected`, `expired`, `cancelled`, `payment_failed`, `refunded`

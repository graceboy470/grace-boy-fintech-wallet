# GRACE BOY Wallet — fixed

## What was fixed
- The dashboard no longer becomes ₦0.00 when the backend is unavailable.
- Demo balance starts at ₦1,250,000.00.
- Demo transactions and cards are restored immediately.
- Add Money works in the browser even if the backend is down.
- Transfer Money works in the browser and deducts the balance.
- Make Payment works in the browser and deducts the balance.
- Add Card and Freeze/Unfreeze work in demo mode when the API is unavailable.
- When the backend is running, API persistence is used automatically.

## Run backend
cd backend
npm install
npm run dev

## Run frontend
cd frontend
npm install
npm run dev

Frontend: http://localhost:5173
Backend: http://localhost:5000
Health: http://localhost:5000/api/health

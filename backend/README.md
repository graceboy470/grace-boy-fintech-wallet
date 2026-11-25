# GRACE BOY Backend

This backend provides a persistent demo wallet API. It uses a local JSON database so you do not need MySQL or MongoDB for this portfolio/demo version.

## Install

cd backend
npm install

## Start

npm run dev

API:
http://localhost:5000

Health:
http://localhost:5000/api/health

## Important

This is a simulated wallet for a frontend/portfolio application. It does not move real bank money, process real cards, or connect to a banking institution.

For production fintech use, replace the JSON wallet with a proper database, authentication, authorization, audit logging, rate limiting, encryption/secrets management, and a regulated payment/banking provider.

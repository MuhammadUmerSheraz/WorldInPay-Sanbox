# Node.js Sample Project

A simple Node.js project using Express framework.

## Features

- Express.js web server
- RESTful API endpoints
- JSON request/response handling

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

Start the server:
```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

- `GET /` - Welcome message
- `GET /api/hello` - Hello endpoint with timestamp
- `POST /api/data` - Accept JSON data (name, email)

### Example Requests

**GET Request:**
```bash
curl http://localhost:3000/api/hello
```

**POST Request:**
```bash
curl -X POST http://localhost:3000/api/data \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'
```

## Project Structure

```
.
├── index.js          # Main application file
├── package.json      # Project dependencies and scripts
├── README.md         # This file
└── .gitignore        # Git ignore rules
```


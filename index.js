const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Node.js Sample Project!',
    status: 'success'
  });
});

app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from the API!',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/data', (req, res) => {
  const { name, email } = req.body;
  res.json({
    message: 'Data received successfully',
    data: {
      name: name || 'Not provided',
      email: email || 'Not provided'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  GET  http://localhost:${PORT}/api/hello`);
  console.log(`  POST http://localhost:${PORT}/api/data`);
});



const express = require('express');
const cors = require('cors');
const campaignRoutes = require('./Routes/campaignRoutes');
const messageRoutes = require('./Routes/messageRoutes');


const app = express();


app.use(cors());
app.use(express.json());


app.use('/campaigns', campaignRoutes);
app.use('/personalized-message', messageRoutes);


app.get('/', (req, res) => {
  res.send('Campaign Management API is running!');
});

module.exports = app;
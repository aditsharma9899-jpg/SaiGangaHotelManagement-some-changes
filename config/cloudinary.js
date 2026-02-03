require("dotenv").config();

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: 'dx7fypwma',
  api_key: '381472973261243',
  api_secret: 'F5iJXPLp0dX0TsrwniFched9-EQ',
});

module.exports = cloudinary;

"use strict";

const prismaMock = require("./prismaMock");
const userFactory = require("./userFactory");
const jwtTest = require("./jwtTest");

module.exports = {
  ...prismaMock,
  ...userFactory,
  ...jwtTest,
};

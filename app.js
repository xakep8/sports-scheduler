const express=require("express");
const path=require("path");
const bodyParser=require("body-parser");




app=express();
app.set("view engine","ejs");
app.use(bodyParser.json());
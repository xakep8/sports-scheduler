const express = require("express");
const app = express();
// const { Todo,User } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
var csurf = require("tiny-csrf");
var cookieParser= require("cookie-parser");
var passport=require("passport");
var connectEnsureLogin=require("connect-ensure-login");
var session=require("express-session");
var LocalStrategy=require("passport-local");
var bcrypt=require("bcrypt");
const flash=require("connect-flash");
const { request } = require("http");
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("todo application"));
app.use(csurf("this_should_be_32_character_long",["POST","PUT","DELETE"]));

app.set("view engine", "ejs");

const saltRounds=10;

const formattedDate = (d) => {
  return d.toISOString().split("T")[0];
};
  
var dateToday = new Date();
const today = formattedDate(dateToday);
const yesterday = formattedDate(
  new Date(new Date().setDate(dateToday.getDate() - 1))
);
const tomorrow = formattedDate(
  new Date(new Date().setDate(dateToday.getDate() + 1))
);

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.use(flash());

app.use(session({
  secret:"the-key-to-future-login-lies-here-84482828282",
  cookie:{
    maxAge: 24*60*60*1000
  }
}));

app.use(function (request,response,next){
  response.locals.messages=request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.get('/',(request,response)=>{
  response.render("index",{
    title:"Sports Scheduler",
    csrfToken:request.csrfToken(),
  })
});

app.get('/signup',(request,response)=>{
  response.render("signup",{title:"Signup",csrfToken:request.csrfToken()});
});

app.get("/signup/admin",(request,response)=>{
  response.render("admin-signup",{title:"Admin-Signup",csrfToken:request.csrfToken()});
});

app.get("/signup/player",(request,response)=>{
  response.render("player-signup",{title:"Player signup",csrfToken:request.csrfToken()});
});

app.post("/adminusers",async (request,response)=>{
  const hashedPwd= await bcrypt.hash(request.body.password,saltRounds);
  if(request.body.firstName==""){
    request.flash("error","First name cannot be left blank");
    return response.redirect("/signup/admin");
  }
  if(request.body.email==""){
    request.flash("error","Email is required for login and cannot be left blank");
    return response.redirect("/signup/admin");
  }
  if(request.body.password==""||request.body.password.length<8){
    request.flash("error","The password must be atleast 8 characters long");
    return response.redirect("/signup/admin");
  }
  try{
    const user=await User.create({
      firstName: request.body.firstName,
      lastName:request.body.lastName,
      email:request.body.email,
      password: hashedPwd,
      role:"admin",
    });
    request.login(user,(err)=>{
      if(err){
        console.log(err);
      }
      response.redirect("/");
    });
  }
  catch(error){
    request.flash("error","Email already registered");
    response.redirect("/signup");
    console.log(error);
  }
});

app.post("/playingusers",async (request,response)=>{
  const hashedPwd= await bcrypt.hash(request.body.password,saltRounds);
  if(request.body.firstName==""){
    request.flash("error","First name cannot be left blank");
    return response.redirect("/signup/player");
  }
  if(request.body.email==""){
    request.flash("error","Email is required for login and cannot be left blank");
    return response.redirect("/signup/player");
  }
  if(request.body.password==""||request.body.password.length<8){
    request.flash("error","The password must be atleast 8 characters long");
    return response.redirect("/signup/player");
  }
  try{
    const user=await User.create({
      firstName: request.body.firstName,
      lastName:request.body.lastName,
      email:request.body.email,
      password: hashedPwd,
      role:"player",
    });
    request.login(user,(err)=>{
      if(err){
        console.log(err);
      }
      response.redirect("/");
    });
  }
  catch(error){
    request.flash("error","Email already registered");
    response.redirect("/signup");
    console.log(error);
  }
});

passport.serializeUser((user,done)=>{
  console.log("Serializing user in session",user.id);
  done(null,user.id);
})

passport.deserializeUser((id,done)=>{
  User.findByPk(id).then(user=>{
    done(null,user);
  }).catch(error=>{
    done(error,null);
  })
});

passport.use(new LocalStrategy({
  usernameField:'email',
  passwordField:'password',
  role:"role",
},(username,password,done)=>{
  User.findOne({where:{email:username}})
  .then(async (user)=>{
    const result=await bcrypt.compare(password,user.password);
    if(result){
      return done(null,user);
    }
    else{
      return done(null,false,{message:"Invalid Password"});
    }
  }).catch((error)=>{
    return done(null,false,{message:"User does not exist"});
  })
}));

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  } else {
    res.status(401).json({ message: 'Unauthorized user.' });
  }
}

module.exports =app;
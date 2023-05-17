const express = require("express");
const app = express();
const { Sports,User,Sportname } = require("./models");
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
      response.redirect("/home");
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
      response.redirect("/home");
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

function requirePlayer(req, res, next) {
  if (req.user && req.user.role === 'player') {
    return next();
  } else {
    res.status(401).json({ message: 'Unauthorized user.' });
  }
}

app.get("/signout",connectEnsureLogin.ensureLoggedIn(),(request,response,next)=>{
  request.logout((err)=>{
    if(err){
      return next(err);
    }
    response.redirect("/");
  });
});

app.post("/adminsession",passport.authenticate('local',{failureRedirect:'/signin',failureFlash:true,}),requireAdmin ,(request,response)=>{
  response.redirect("/home");
});

app.post("/playersession",passport.authenticate('local',{failureRedirect:'/signin',failureFlash:true,}),requirePlayer ,(request,response)=>{
  response.redirect("/home");
});

app.get("/home",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  console.log(request.user.id);
  const acc=await User.findByPk(request.user.id);
  const sportslist=await Sportname.findAll();
  const role=acc.role;
  const userName=acc.firstName+" "+acc.lastName;
  if (request.accepts("html")) {
    response.render("home",{
        userName,
        role,
        sportslist,
        csrfToken: request.csrfToken(),
    });
  } else {
    response.json({
      userName,
    });
  }
});

app.get("/signin",(request,response)=>{
  response.render("signin",{title:"Signin",csrfToken:request.csrfToken()});
});

app.get("/signin/admin",(request,response)=>{
  response.render("admin-signin",{title:"Admin Signin",csrfToken:request.csrfToken()});
});

app.get("/signin/player",(request,response)=>{
  response.render("player-signin",{title:"Player Signin",csrfToken:request.csrfToken()});
});

app.get("/createsession",connectEnsureLogin.ensureLoggedIn(),(request,response)=>{
  response.render("createsession",{title:"Create Session",csrfToken:request.csrfToken()});
});

app.post("/addsession",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const title=request.body.title;
  const date=request.body.date;
  const time=request.body.time;
  const location=request.body.location;
  var players=request.body.players;
  const addtional=request.body.additional;
  const acc=await User.findByPk(request.user.id);
  const username=acc.email;
  players=username+','+players;
  const playerlist=players.split(',');
  var playerlist1="";
  for(var i=0;i<playerlist.length;i++){
    const player=await User.findOne({where:{email:playerlist[i]}});
    if(player){
      playerlist1=playerlist1+player.id.toString()+',';
    }
  }
  if(location===""||location===undefined){
    request.flash("error","The location of the session cannot be left blank");
    response.redirect(`/createsession/${title}`);
  }
  if(addtional===""||addtional===undefined){
    if(players===""||players===undefined){
      request.flash("error","A session must have atleast two players");
      response.redirect(`/createsession/${title}`);
    }
  }
  try{
    Sports.create({title:title,date:date,time:time,location:location,players:playerlist1,addtional:addtional,userId:request.user.id});
    response.redirect("/sport/"+title);
  }
  catch(error){
    console.log(error);
  }
});

app.get("/createsport",requireAdmin,(request,response)=>{
  response.render("createsport",{title:"Create Sport",csrfToken:request.csrfToken()});
});

app.post("/addsport",requireAdmin,async (request,response)=>{
  const title=request.body.title;
  if(title===""){
    request.flash("error","Name of the sport cannot be left blank");
    return response.redirect("/createsport");
  }
  try{
    Sportname.create({title:title,userId:request.user.id});
    response.redirect("/home");
  }
  catch(error){
    console.log(error);
  }
});

app.get("/sport/:sport",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const acc=await User.findByPk(request.user.id);
  const role=acc.role;
  const sport=request.params.sport;
  const sessions= await Sports.findAll({where:{title:sport}});
  response.render("sport",{sport:sport,csrfToken:request.csrfToken(),role:role,ses:sessions});
});

app.get("/createsession/:sport",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const sport=request.params.sport;
  response.render("createsession",{title:"Create Session",csrfToken:request.csrfToken(),sport:sport});
});

app.get("/session/:id",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const id=request.params.id;
  const session=await Sports.findByPk(id);
  const owner=await User.findByPk(session.userId);
  const ownername=owner.firstName+" "+owner.lastName;
  const acc=await User.findByPk(request.user.id);
  const role=acc.role;
  const userName=acc.firstName+" "+acc.lastName;
  const players=session.players;
  const playerlist=players.split(",");
  const playerlist1=[];
  const play=[];
  if(playerlist.length>0){
    for(let i=0;i<playerlist.length;i++){
      if(Number(playerlist[i]).toString()!="NaN"){
        play.push(playerlist[i]);
        const player= await User.findByPk(Number(playerlist[i]));
        if(player){
          const playername=player.firstName+" "+player.lastName;
          playerlist1.push(playername);
        }
      }
    }
  }
  response.render("session",{title:"Session",csrfToken:request.csrfToken(),session:session,role:role,userid:request.user.id,userName:userName,owner:ownername,players:playerlist1,playerid:play});
});

app.put("/session/:id",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  try{
    const session=await Sports.findByPk(request.params.id);
    return response.json(session.update({players:request.body.player}));
  }
  catch(error){
    console.log(error);
    return response.status(422).json(error);
  }
});

app.put("/admin/session/:id",requireAdmin,async (request,response)=>{
  try{
    const session=await Sports.findByPk(request.params.id);
    return response.json(session.update({players:request.body.player}));
  }
  catch(error){
    console.log(error);
    return response.status(422).json(error);
  }
});

module.exports =app;
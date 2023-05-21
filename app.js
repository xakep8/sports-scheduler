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
const { resourceUsage } = require("process");
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

app.get('/',async (request,response)=>{
  await Sports.destroy({where:{}});
  await Sportname.destroy({where:{}});
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
      sessions:"",
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
    response.redirect("/signup/admin");
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
      sessions:"",
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
    response.redirect("/signup/player");
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

passport.use('local',new LocalStrategy({
  usernameField:'email',
  passwordField:'password',
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

// passport.use('local', new LocalStrategy(
//   { usernameField: 'email' },
//   function(email, password, done) {
//     User.findOne({ email: email }, function(err, user) {
//       if (err) { return done(err); }

//       if (!user || !user.validPassword(password)) {
//         return done(null, false, { message: 'Incorrect email or password.' });
//       }

//       return done(null, user);
//     });
//   }
// ));

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

app.post("/adminsession",passport.authenticate('local',{failureRedirect:'/signin/admin',failureFlash:true,}),requireAdmin ,(request,response)=>{
  response.redirect("/home");
});

app.post("/playersession",passport.authenticate('local',{failureRedirect:'/signin/player',failureFlash:true,}),requirePlayer ,(request,response)=>{
  response.redirect("/home");
});

app.get("/home",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  console.log(request.user.id);
  const acc=await User.findByPk(request.user.id);
  const sessions=acc.sessions;
  const sessionid=sessions==null?[]:sessions.split(",");
  const usersessions=[];
  for(var i=0;i<sessionid.length;i++){
    if(Number(sessionid[i]).toString()!="NaN"&&sessionid[i]!=""&&sessionid[i]!=null){
      const sess=await Sports.findOne({where:{id:sessionid[i]}});
      if(sess){
        const t=new Date().toISOString().split("T");
        const date=t[0];
        console.log(date);
        const time=t[1].substring(0,5);
        const gtime=sess.time;
        if(sess.date==date){
          if(gtime>time){
            usersessions.push(sess);
          }
        }
        else if(sess.date>date){
          usersessions.push(sess);
        }
      }
    }
  }
  const sportslist=await Sportname.findAll();
  const role=acc.role;
  const userName=acc.firstName+" "+acc.lastName;
  if (request.accepts("html")) {
    response.render("home",{
        userName,
        role,
        sportslist,
        usersessions,
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
  var addtional=Number(request.body.additional);
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
    const session=await Sports.create({title:title,date:date,time:time,location:location,players:playerlist1,additional:addtional,userId:request.user.id});
    console.log(addtional);
    var usersess=acc.sessions;
    usersess+=','+session.id;
    await acc.update({sessions:usersess});
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
    await Sportname.create({title:title,userId:request.user.id});
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
  const upsessions=[];
  for(var i=0;i<sessions.length;i++){
      const t=new Date().toISOString().split("T");
      const date=t[0];
      const time=t[1].substring(0,5);
      const gtime=sessions[i].time;
      if(sessions[i].date==date){
        if(gtime>time){
          upsessions.push(sessions[i]);
        }
      }
      else if(sessions[i].date>date){
        upsessions.push(sessions[i]);
      }
  }
  try{
    const all=await Sportname.findAll({where:{title:sport}});
    console.log(all);
    const sports=all[0];
    response.render("sport",{sport:sport,csrfToken:request.csrfToken(),role:role,ses:upsessions,userid:request.user.id,owner:sports.userId});
  }
  catch(error){
    console.log(error);
  }
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
  const sport=await Sportname.findOne({where:{title:session.title}});
  const sportowner=sport.userId;
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
  response.render("session",{title:"Session",csrfToken:request.csrfToken(),session:session,role:role,userid:request.user.id,userName:userName,owner:ownername,players:playerlist1,playerid:play,sportowner:sportowner,sport:session.title});
});

app.put("/session/:id",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const user=await User.findOne({where:{id:request.user.id}});
  var usersessions=user.sessions;
  const session=await Sports.findByPk(request.params.id);
  var additional=Number(session.additional);
  if(request.body.type=="join"){
    additional-=1;
    usersessions+=','+request.params.id;
  }
  else if(request.body.type=="leave"){
    additional+=1;
    const n=usersessions.split(",");
    var str="";
    for(var i=0;i<n.length;i++){
      if(n[i]!=request.body.session){
        str+=n[i];
        if(i!=n.length-1){
          str+=',';
        }
      }
    }
    usersessions=str;
  }
  try{
    await user.update({sessions:usersessions});
    await session.update({players:request.body.player,additional:additional});
    return response.json({Success:true});
  }
  catch(error){
    console.log(error);
    return response.status(422).json(error);
  }
});

app.delete("/session/:id",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const session=await Sports.findOne({where:{id:request.params.id}});
  if(session.userId!=request.user.id){
    request.flash("error","You are not authorized to delete this session");
    return response.redirect(`/session/${request.params.id}`);
  }
  try{
    await Sports.destroy({where:{id:request.params.id}});
    return response.json({Success:true});
  }
  catch(error){
    console.log(error);
    return response.status(422).json(error);
  }
});

app.delete("/sport/:sport",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const sport=await Sportname.findOne({where:{title:request.params.sport}});
  if(sport.userId!=request.user.id){
    request.flash("error","You are not authorized to delete this session");
    return response.redirect(`/sport/${request.params.sport}`);
  }
  try{
    await Sports.destroy({where:{title:request.params.sport}});
    await Sportname.destroy({where:{title:request.params.sport}});
    return response.json({Success:true});
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

app.get("/sport/:sport/report",requireAdmin,async (request,response)=>{
  const sessions= await Sports.findAll({where:{title:request.params.sport}});
  const upsessions=[];
  const pastsessions=[];
  for(var i=0;i<sessions.length;i++){
      const t=new Date().toISOString().split("T");
      const date=t[0];
      const time=t[1].substring(0,5);
      const gtime=sessions[i].time;
      if(sessions[i].date==date){
        if(gtime>time){
          upsessions.push(sessions[i]);
        }
        else{
          pastsessions.push(sessions[i]);
        }
      }
      else if(sessions[i].date>date){
        upsessions.push(sessions[i]);
      }
      else{
        pastsessions.push(sessions[i]);
      }
  }
  response.render("reports",{csrfToken:request.csrfToken(),pastses:pastsessions,upses:upsessions,sport:request.params.sport});
});

app.get("/session/:id/edit",requireAdmin,(request,response)=>{
  const id=request.params.id;
  response.render("editsession",{title:"Update Session",csrfToken:request.csrfToken(),id:id});
});

app.get("/session/:id/updatesession",requireAdmin,async (request,response)=>{
  const date=request.body.date;
  const time=request.body.time;
  const location=request.body.location;
  var players=request.body.players;
  var addtional=Number(request.body.additional);
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
    response.redirect(`/session/${request.params.id}/edit`);
  }
  if(addtional===""||addtional===undefined){
    if(players===""||players===undefined){
      request.flash("error","A session must have atleast two players");
      response.redirect(`/session/${request.params.id}/edit`);
    }
  }
  try{
    const session=await Sports.update({date:date,time:time,location:location,players:playerlist1,additional:addtional});
    console.log(addtional);
    var usersess=acc.sessions;
    usersess+=','+session.id;
    await acc.update({sessions:usersess});
    response.redirect("/home");
  }
  catch(error){
    console.log(error);
  }
});

app.get("/changepassword",connectEnsureLogin.ensureLoggedIn(),(request,response)=>{
  response.render("changepassword",{csrfToken:request.csrfToken()});
});

app.post("/updatepassword",connectEnsureLogin.ensureLoggedIn(),async (request,response)=>{
  const user=await User.findOne({where:{id:request.user.id}});
  const newhashedpwd=await bcrypt.hash(request.body.newpass,saltRounds);
  if(request.body.newpass==request.body.renewpass){
    await user.update({password:newhashedpwd});
    request.flash("error","Your password has changed");
    return response.redirect("/home");
  }
  else{
    request.flash("error","Passwords do not match");
    response.redirect("/changepassword");
  }
});

app.get("/login",(request,response)=>{
  response.redirect("/signin");
});

module.exports =app;
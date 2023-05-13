const request = require("supertest");

const db = require("../models/index");
const app = require("../app");
var cheerio = require("cheerio");

let server, agent;
function extractCsrfToken(res){
  var $= cheerio.load(res.text);
  return $("[name=_csrf]").val();
}
const login =async (agent,username,password)=>{
  let res=await agent.get("/login");
  let csrfToken=extractCsrfToken(res);
  await agent.post("/session").send({
    email:username,
    password:password,
    _csrf:csrfToken,
  });
};
describe("Sports-Scheduler Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  // test("This is an empty test",()=>{
  //   expect(true).toBe(true);
  // });

  test("To check the admin signup function", async ()=>{
    let res=await agent.get("/signup/admin");
    const csrfToken=extractCsrfToken(res);
    res=await agent.post("/adminusers").send({
      firstName:"Test",
      lastName: "User A",
      email: "usera@test.com",
      password:"helloworld",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("To check the player signup function", async ()=>{
    let res=await agent.get("/signup/player");
    const csrfToken=extractCsrfToken(res);
    res=await agent.post("/playingusers").send({
      firstName:"Test",
      lastName: "User A",
      email: "usera@test.com",
      password:"helloworld",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });
});
import nc from 'next-connect';
import { User } from '../../../scripts/mongo.js';
import { serialize } from 'cookie';
const app = nc();

app.get(async (req, res) => {
  let token = req.query.token;
  let findUser = await User.findOne({ token: token });
  if(findUser){
    findUser.verified = true;
    findUser.save();
    res.setHeader('Set-Cookie', serialize('sid', findUser.token, { path: '/', maxAge: 1000 * 3600 * 24 * 365 * 10 })).redirect("/dashboard")
  }else{
    res.redirect("/signup")
  }
})

export default app;
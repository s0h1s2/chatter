const express=require('express');
const app=express();
const server=require('http').createServer(app)
const io=require('socket.io')(server);
const path=require('path');
const mongoose=require('mongoose');
const bodyParser=require('body-parser');
const passport=require('passport');
const LocalStrategy =require('passport-local');
const ensureLogedin=require('connect-ensure-login');
const expressSesssion=require('express-session');
const User=require('./models/user');
app.use(expressSesssion({
    secret:'mysecret',
    saveUninitialized:false,
    resave:true,
    unset:false
}));

app.use(bodyParser.urlencoded({extended:true}))
mongoose.connect('mongodb://localhost/chatter',{ useNewUrlParser:true,useUnifiedTopology:true })
.then(()=>console.log("Connected to mongodb successfully"))
.catch((e)=>console.log("Error while connect mongodb",e.message));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
var onlineUsers={};
app.get('/',(req,res)=>{
    if(req.isAuthenticated())
    {
        return res.redirect('/dashboard');
    }
    return res.redirect('/login');

});

app.get('/login',ensureLogedin.ensureLoggedOut(),(req,res)=>{
    res.render("authentication/login",{ title:"Login" });
});
app.post('/login',ensureLogedin.ensureLoggedOut(),passport.authenticate('local',{ session:true,failureRedirect:'/login',}),function(req,res){
    return res.redirect('/dashboard');
});

app.get('/register',ensureLogedin.ensureLoggedOut(),async (req,res)=>{
    
    res.render("authentication/register",{ title:"Register",errors:{} });
});

app.post('/register',validateUserInput,async (req,res)=>{    
    const errors={};
    const user=await User.findOne({ username:req.body.username });
    {
        if(user)
        {
            errors.unique="Username should be unique";       
            return res.render("authentication/register",{ title:"Register",errors:errors });     
        }
    }
    const newUser=new User({ username:req.body.username,password:req.body.password });
    await newUser.save();
    return res.redirect('/login');
    
});
app.get('/dashboard',ensureLogedin.ensureLoggedIn(),(req,res)=>{
    res.render("dashboard/dashboard",{ title:"Dashboard",onlineUsers:onlineUsers,user:req.user});
});
function validateUserInput(req,res,next){
    
    var errors={};
    if(req.body.username=='')
    {
        errors.username="Username shouldn't be empty";
    }
    if(req.body.password=='')
    {
        errors.password="password shouldn't be empty";
    }
    if( req.body.retypepassword!=req.body.password)
    {
        errors.retypepassword="password should be equal";
    }
    if(Object.keys(errors).length!=0)
    {
        return res.render('authentication/register',{ errors:errors,title:"Register" });
    }
    return next();
}
passport.use(new LocalStrategy(function(username,password,done)
{
    User.findOne({ username:username },function(err,user){
        if(err) return done(err)
        if(!user) return done(null,false);
        if(user.password!=password) return done(null,false);
        return done(null,user);
    });
}));
passport.serializeUser(function(user,done){
    done(null,{id:user._id,username:user.username});

});
passport.deserializeUser(function(user,done){
    done(null,user);
});
var activeUsers={};
io.on('connection',(socket)=>{
    socket.on('login',(data)=>{
        if(!activeUsers[data.id])
        {
            activeUsers[data.id]=data;
            socket.userid=data.id;   
            io.sockets.emit("add user",activeUsers); 
        }
    });
    socket.once('disconnect',()=>{
        io.sockets.emit('user disconnect',{id:socket.userid});
        delete activeUsers[socket.userid];
    });
    socket.on('user send',(data)=>{
        console.log(data);
        for(let key in io.clients().connected )
        {
            if(io.clients().connected[key].userid==data.reciver)
            {
                io.to(io.clients().connected[key].id).emit("message recivce",{ text:data.text});
            }
        }
        
    })
});
const PORT=3000;
server.listen(PORT,()=>console.log(`Listening on port ${PORT}`));

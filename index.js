const express=require('express');
const cors=require('cors');
const mongoose = require("mongoose");
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const imageDownloader=require('image-downloader');//to download image from link

const User =require('./models/User.js');
const Place=require('./models/Place.js');
const Booking=require('./models/Booking.js');

const CookieParser=require('cookie-parser');
const multer=require('multer');
const fs=require('fs');

require('dotenv').config();
const app=express();


app.use(express.json());
app.use(CookieParser());
app.use('/uploads',express.static(__dirname+'/uploads'));

const bcryptSalt=bcrypt.genSaltSync(10);
const jwtSecret='fasefraw4r5sdflsdfsdff';
const allowedOrigins = ['http://localhost:5173','http://127.0.0.1:5173'];
 const corsOptions = {
    origin: (origin, callback) => {
      if (true) {
         callback(null, true);// Allow requests with a matching origin or without an origin (e.g., from file://)
      } else {
       callback(new Error('Not allowed by CORS'));//Unallowed origin so block it
      }
    },
    credentials: true // If you need to allow cookies and other credentials to be sent in the request
  };
  
app.use(cors(corsOptions));


mongoose.connect(process.env.MONGO_URL);

function getUserDataFromReq(req){
  const {token}=req.cookies;
  return new Promise((resolve,reject)=>{
      jwt.verify(token,jwtSecret,{},async(err,userData)=>{
          if(err) throw err;
          resolve(userData);
      });
  });
}


app.get('/test',(req,res)=>{
    res.json('test ok!');
});

app.post('/register',async(req,res)=>{
    const {name,email,password}=req.body;
    try{
      const userDoc=await User.create({
        name,
        email,
        password:bcrypt.hashSync(password,bcryptSalt),
      });    
      //console.log(userDoc);
      res.json(userDoc);

    }catch(e){
      res.status(422).json(e);
    }
});

app.post('/login',async(req,res)=>{
  const{email,password}=req.body;
   try{
    const userDoc=await User.findOne({email}).maxTimeMS(20000);
    if(userDoc){
      const passOk=bcrypt.compareSync(password,userDoc.password);
      if(passOk){
        jwt.sign({ email:userDoc.email,id:userDoc._id,},jwtSecret,{},(err,token)=>{
          if(err) throw err;
          res.cookie('token',token).json(userDoc);
        });//signing a cookie
       
      }
      else{
        res.status(422).json('Incorrect Password! Try again!');
      } 
    }
    else{
      console.log('Not found!');
      res.json('Not found!');
     
    }
  }catch(ex){
    res.status(422).json(ex);
  }
});

app.get('/profile',(req,res)=>{
    const {token}=req.cookies;
    if(token){
      jwt.verify(token,jwtSecret,{},async(err,userData)=>{
          if(err) throw err;
          const {name,email,_id}=await User.findById(userData.id).maxTimeMS(20000);
          res.json({name,email,_id});
      });
    }else{
      res.json(null);
    }
    
});

app.post('/logout',(req,res)=>{
     res.cookie('token','').json(true);
});

// console.log({__dirname});
app.post('/upload-by-link',async(req,res)=>{ //endpoint for uploading image through link
  const {link}=req.body; 
  const newName= 'photo' + Date.now()+'.jpg';

  await imageDownloader.image({
    url:link,
    dest: __dirname+'/uploads/'+newName,
  });
  res.json(newName);
});


const photosMiddleware = multer({dest:'uploads/'});
app.post('/upload',photosMiddleware.array('photos',100),(req,res)=>{
    const uploadedFiles=[];
    for(let i=0;i<req.files.length;i++){
      const { path, originalname } = req.files[i];
      const parts = originalname.split('.'); //first part will be filename and second will be the extension
      const ext = parts[parts.length - 1];
      const newPath = path + '.' + ext;
      fs.renameSync(path, newPath);
      //console.log(newPath);
      const filename = newPath.replace('uploads\\', ''); // Only the filename with extension
      uploadedFiles.push(filename);
      }
      //console.log(uploadedFiles);
      res.json(uploadedFiles);
});

app.post('/places',(req,res)=>{
    const {token}=req.cookies;
    const { title,address,addedPhotos,description,perks,extraInfo,checkIn,checkOut,maxGuests,price}=req.body;
    //console.log(req.body);
    jwt.verify(token,jwtSecret,{},async(err,userData)=>{
        if(err) throw err;
        const placeDoc=await Place.create({
          owner: userData.id,
          title,address,photos:addedPhotos,description,
          perks,extraInfo,checkIn,checkOut,maxGuests,price
        });
        res.json(placeDoc);   
    });    
});

app.get('/user-places',(req,res)=>{
    const {token}=req.cookies;
    jwt.verify(token,jwtSecret,{},async(err,userData)=>{
      const {id}=userData;
      res.json(await Place.find({owner:id}));
  });   
});

app.get('/places/:id',async(req,res)=>{
    const {id}=req.params;
    res.json(await Place.findById(id));
});

app.put('/places',async(req,res)=>{ //updation
    const {token}=req.cookies;
    const {id,title,address,addedPhotos,description,perks,
           extraInfo,checkIn,checkOut,maxGuests,price}=req.body;

    jwt.verify(token,jwtSecret,{},async(err,userData)=>{
        if(err) throw err;
        const placeDoc = await Place.findById(id);
        if(userData.id===placeDoc.owner.toString()){
          placeDoc.set({
            title,address,photos:addedPhotos,description,perks,extraInfo,checkIn,checkOut,maxGuests,price,
          });
          await placeDoc.save();
          res.json("ok");
        }
    });   
});    
app.get('/places',async(req,res)=>{
    res.json(await Place.find().maxTimeMS(20000));
});

    
app.post('/bookings', async (req, res) => {
  const userData= await getUserDataFromReq(req);
  const { place, checkIn, checkOut, numberOfGuests, name, phone, price } = req.body;

  Booking.create({
    place,user:userData.id,checkIn, checkOut, numberOfGuests, name, phone, price
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      console.error(err); // Log the error
      res.status(500).json({ error: 'An error occurred while creating the booking.' });
    });
});



app.get('/bookings',async (req,res)=>{ // bookings are private so we need token validation
     const userData=await getUserDataFromReq(req);
     res.json(await Booking.find({user:userData.id}).populate('place')); //display all the bookings for the current user
});



app.listen(4000);

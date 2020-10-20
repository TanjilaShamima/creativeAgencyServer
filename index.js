const express = require('express');
require('dotenv').config()
const multer = require('multer');
const cloudinary = require('cloudinary');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const MongoClient = require('mongodb').MongoClient;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@programming-hero.eg1nk.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const {ObjectId} = require('mongodb');
const serviceAccount = require("./configs/creative-agency-e22a7-firebase-adminsdk-nsck7-2ee8ac371f.json");


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.API_KEY, 
    api_secret: process.env.API_SECRET 
  });

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIRE_URL
  });

const storage = multer.diskStorage({
    destination: (req, file, callback) =>{
        callback(null, 'uploads')
    },
    filename: (req, file, callback) =>{
        callback(null, file.fieldname+path.extname(file.originalname))
    }
})

const upload = multer({
    storage: storage
});

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true  });
client.connect(err => {
    const serviceCollection = client.db("creativeAgencyDB").collection("services");
    const adminCollection = client.db("creativeAgencyDB").collection("admins");
    const serviceRegistrationCollection = client.db("creativeAgencyDB").collection("serviceRegistration");
    const reviewCollection = client.db("creativeAgencyDB").collection("reviews");

    app.post('/addService',upload.single('serviceBanner'), async (req, res) => {
        const result = await cloudinary.uploader.upload(req.file.path).catch(cloudError => console.log(cloudError));
        if(result){
            const serviceData = {...req.body, photo: result.secure_url};  
            serviceCollection.insertOne(serviceData)
            .then(result => {
                if(result.insertedCount < 0){
                    res.send({"status": "error","message": `<p className="text-danger">Data corrupted</p>`})
                }
                else{
                    res.send(result.ops[0]);
                }
            })
            .catch(dbError => console.log(dbError));
        }
        else{
            res.status(404).send('Upload Failed');
        }
    })

    app.get('/getServices', (req, res) => {
        serviceCollection.find({})
        .toArray((err, documents) => {
            res.send(documents)
        })
    })

    app.get('/getReviews', (req, res) => {
        reviewCollection.find().limit(3).hint( { $natural : -1 } )
        .toArray((err, documents) => {
            if(err) console.log(err);
            res.send(documents)
        })
    })

    app.post('/registration', (req, res) => {
        const registrationInfo = req.body;
        registrationCollection.insertOne(registrationInfo)
        .then((result) => {
            if(result.insertedCount > 0){
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`});
            }
            else{
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`})
            }
        })
    })

    app.post('/adminEntry', (req, res) => {
        const adminEmail = req.body;
        adminCollection.insertOne(adminEmail)
        .then((result) => {
            if(result.insertedCount > 0){
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`});
            }
            else{
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`})
            }
        })
    })

    app.post('/order', (req, res) => {
        const orderInfo = req.body;
        serviceRegistrationCollection.insertOne(orderInfo)
        .then((result) => {
            if(result.insertedCount > 0){
                res.send(result.ops[0]);
            }
            else{
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`})
            }
        })
    })

    app.post('/postReview', (req, res) => {
        const review = req.body;
        reviewCollection.insertOne(review)
        .then((result) => {
            if(result.insertedCount > 0){
                res.send(result.ops[0]);
            }
            else{
                res.send({"status": "success","message": `<p className="text-success">Data inserted!</p>`})
            }
        })
    })

    app.get('/adminSearch', (req, res) => {
        const {email} = req.query;
        adminCollection.find({ adminEmail : email})
        .toArray((err, documents) => {
            res.send(documents);
        })
    })

    app.get('/getOrders', (req, res) => {
        const bearer = req.headers.authorization;
        if(bearer && bearer.startsWith('Bearer ')){
          const userToken = bearer.split(' ')[1];
          admin.auth().verifyIdToken(userToken)
          .then(function(decodedToken) {
            serviceRegistrationCollection.find({})
                .toArray((err, documents) => {
                    res.send(documents);
                })
          }).catch(function(error) {
            res.status(401).send({"status":"Unautorized"});
          });
        }
        else{
          res.status(401).send({"status":"Unautorized"});
        }
    })


    app.get('/getOrdersFor', (req, res) => {
        const {user} = req.query;
        const bearer = req.headers.authorization;
        if(bearer && bearer.startsWith('Bearer ')){
          const userToken = bearer.split(' ')[1];
          admin.auth().verifyIdToken(userToken)
          .then(function(decodedToken) {
            serviceRegistrationCollection.find({email: user})
                .toArray((err, documents) => {
                    res.send(documents);
                })
          }).catch(function(error) {
            res.status(401).send({"status":"Unautorized"});
          });
        }
        else{
          res.status(401).send({"status":"Unautorized"});
        }
    })

    app.patch('/updateStatus/:id', (req, res) => {
        serviceRegistrationCollection.updateOne({_id : ObjectId(req.params.id)},
        {
            $set:{ serviceStatus: req.body.status}
        })
        .then(result => res.send(result.modifiedCount > 0));
    })

});


app.get('/', (req, res) => {
    res.send('Hello Creative Agency');
})

app.listen(process.env.PORT || 5000);
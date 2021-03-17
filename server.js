import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import GridFsStorage from 'multer-gridfs-storage';
import Grid from 'gridfs-stream';
import path from 'path';
import Pusher from 'pusher';
import bodyParser from 'body-parser';
import multer from 'multer';


import mongoPosts from './postModel.js';

const app = express();

Grid.mongo = mongoose.mongo




//APP CONFIG


const port = process.env.PORT || 9000



//this key coply form pusher.com

const pusher = new Pusher({
    appId: "1172767",
    key: "4096e93b708dd136d79a",
    secret: "358c33e9bf159af74a67",
    cluster: "ap2",
    useTLS: true
});



//Middleware
app.use(bodyParser.json());
app.use(cors());



//DB CONFIG
const mongoURI = "mongodb+srv://moss2:8253965814@cluster0.ukoeu.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"

const conn = mongoose.createConnection(mongoURI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
});

mongoose.connection.once('open', () => {
    console.log('DB Connected')

    const changeStream = mongoose.connection.collection('posts').watch()

    changeStream.on('change', (change) => {
        console.log(change)

        if (change.operationType === 'insert') {
            console.log('Tringgering Pusher')

            pusher.tringger('posts', 'inserted', {
                change: change
            })
        } else {
            console.log('Enter trigger Pusher')
        }
    })
})





let gfs

conn.once('open', () => {
    console.log('DB Connected')

    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection('images')
})


const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = `image-${Date.now()}${path.extname(file.originalname)}`

            const fileInfo = {
                filename: filename,
                bucketName: 'images'
            };
            resolve(fileInfo);
        });
    }
});

const upload = multer({ storage });

mongoose.connect(mongoURI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
});

//APP ROUTES
app.get('/', (req, res) => res.status(200).send('Hello World'))


app.post('/upload/image', upload.single('file'), (req, res) => {
    res.status(201).send(req.file)
})


app.post('/upload/post', (req, res) => {
    const dbPost = req.body

    mongoPosts.create(dbPost, (err, data) => {
        if (err) {
            res.status(500).send(err)
        } else {
            res.status(201).send(data)
        }
    })
})




app.get('/retrieve/posts', (req, res) => {
    mongoPosts.find((err, data) => {
        if (err) {
            res.status(500).send(err)
        } else {
            data.sort((b, a) => {
                return a.timestamp - b.timestamp;
            })


            res.status(200).send(data)
        }
    })
})



app.get('/retrieve/images/single', (req, res) => {
    gfs.files.findOne({ filename: req.query.name }, (err, file) => {
        if (err) {
            res.status(500).send(err)
        } else {
            if (!file || file.length === 0) {
                res.status(404).json({ err: 'file not found' })
            } else {
                const readstream = gfs.createReadStream(file.filename);
                readstream.pipe(res);
            }
        }
    })
})
//listen

app.listen(port, () => console.log(`listening on localhost:${port}`));


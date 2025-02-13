import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);


app.get('*', (req, res): void => {

    if(req.path.startsWith("/assets/")) {
        if(fs.existsSync(path.join(__dirname, '../public', req.path))) {
            res.sendFile(path.join(__dirname, '../public', req.path));
        } else {
            res.status(404).send('Ressource Not found');
        }
        return;
    }
    
    if(req.path === '/') {
        res.sendFile(path.join(__dirname, '../public', 'index.html'));
        return
    }
    if(fs.existsSync(path.join(__dirname, '../public', `${req.path}.html`))) {
        res.sendFile(path.join(__dirname, '../public', `${req.path}.html`));
    } else {
        res.sendFile(path.join(__dirname, '../public', '404.html'));
    }
    return;

})

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
const express = require('express');
const app = express();
const resumes = require('./resumes.js');
const classifications = require('./classifications.js');
const detailsMatches = require('./details_matches.js');
const folderRoot = 'matches';

app.use(express.json());

app.get('/resumes', async (req, res, next) => {
    try {
        await resumes();
        res.status(200).send('Scraping de Jogos Completada.');
    } catch (error) {
        next(error);
    }
});

app.get('/classifications', async (req, res, next) => {
    try {
        await classifications();
        res.status(200).send('Scraping de Classificações Completada.');
    } catch (error) {
        next(error);
    }
});

app.get('/detailsmatches', async (req, res, next) => {
    try {
        await detailsMatches(folderRoot);
        res.status(200).send('Scraping de Detalles de Partidos Completado.');
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).send(`Error: ${error.message}`);
});

app.use((req, res) => {
    res.status(404).send('Ruta Inválida.');
});

const port = 80;
app.listen(port, () => {
    console.log(`Servidor à escuta no porto ${port}`);
});
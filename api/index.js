const express = require('express');
const http = require('http');
const url = require('url');
const app = express();
const resumes = require('./resumes.js');
const classifications = require('./classifications.js');
const detailsMatches = require('./details_matches.js');
const folderRoot = 'matches';

const server = http.createServer((req, res) => {
    const { pathname, query } = url.parse(req.url, true);
    const fixtureId = query;

    if (pathname === '/resumes' && req.method === 'GET') {
        resumes()
            .then(() => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Scraping de Jogos Completada.');
            })
            .catch((error) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`Erro ao realizar o scraping de Jogos: ${error}`);
            });
    } else if (pathname === '/classifications' && req.method === 'GET' && fixtureId) {
        classifications(fixtureId)
            .then(() => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end('Scraping de Classificações Completada.');
            })
            .catch((error) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`Erro a obter os dados de classificações: ${error}`);
            });
    } else if (pathname === '/detailsmatches' && req.method === 'GET') {
        detailsMatches(folderRoot)
            .then(() => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Scraping de Detalles de Partidos Completado.');
            })
            .catch((error) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`Error al obtener los datos de los detalles de los partidos: ${error}`);
                console.error(error);
            });
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Ruta Inválida.');
    }
});

const port = 80;
server.listen(port, () => {
    console.log(`Servidor à escuta no porto ${port}`);
});

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
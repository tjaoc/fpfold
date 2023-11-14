const axios = require("axios");
const { parse } = require("node-html-parser");
const { writeFile } = require("fs").promises;
const path = require("path");
const { BASE_URL, FIXTURE_URL } = require('./config.js');

const fixtureId = 505680;  // Definir fixtureId aquí

const saveClassifications = async (matchesData) => {
  const folderPath = path.join(__dirname, "classifications");
  const fileName = "classification.json";
  const filePath = path.join(folderPath, fileName);
  try {
    await writeFile(filePath, JSON.stringify(matchesData, null, 2)); // Specify indentation of 2 spaces
    console.log(`Archivo ${filePath} guardado exitosamente.`);
  } catch (error) {
    console.error(`Error al guardar el archivo ${filePath}:`, error);
  }
};

const fetchClassifications = async () => {  // Eliminar el argumento fixtureId
  try {
    const url = `${BASE_URL}${FIXTURE_URL}${fixtureId}`;
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json"
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error al realizar la solicitud HTTP:", error);
    throw error;
  }
};

const parseClassifications = (body) => {
  const matchesData = [];
  const root = parse(body);
  const gameClassifications = root.querySelectorAll(".game.classification");
  const gameClassificationData = gameClassifications.map((classification) => {
    const data = classification.text.split("\r\n").filter(Boolean);
    const teamName = data[1].trimStart();
    return {
      position: parseInt(data[0]),
      team: teamName,
      matches: parseInt(data[2]),
      victories: parseInt(data[3]),
      defeats: parseInt(data[4]),
      draws: parseInt(data[5]),
      scored_goals: parseInt(data[6]),
      goals_suffered: parseInt(data[7]),
      points: parseInt(data[8]),
    };
  });
  matchesData.push(...gameClassificationData);
  return matchesData;
};

const processClassifications = async () => {
  const body = await fetchClassifications();
  const matchesData = parseClassifications(body);
  await saveClassifications(matchesData);
  return matchesData;
};

module.exports = processClassifications;

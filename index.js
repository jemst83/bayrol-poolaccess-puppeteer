import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import mqtt from 'mqtt';

puppeteer.use(StealthPlugin());

const USERNAME = process.env.BAYROL_USERNAME;
const PASSWORD = process.env.BAYROL_PASSWORD;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

async function run() {
  console.log(`Starte mit Benutzer: ${USERNAME}`);
  console.log(`MQTT-Broker: ${MQTT_BROKER}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('Öffne Login-Seite...');
  await page.goto('https://www.bayrol-poolaccess.de/webview/', { waitUntil: 'networkidle2' });

  console.log('Fülle Login-Formular aus...');
  await page.type('#username', USERNAME);
  await page.type('#password', PASSWORD);

  console.log('Sende Login...');
  await Promise.all([
    page.click('button[type="submit"], input[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  console.log('Login erfolgreich, lade Pooldaten...');
  await page.goto('https://www.bayrol-poolaccess.de/webview/getdata.php?cid=49458', { waitUntil: 'networkidle2' });
  const data = await page.evaluate(() => document.body.innerText);
  console.log('Pooldaten:', data);

  console.log('Sende Daten an MQTT...');
  const client = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD
  });

  client.on('connect', () => {
    client.publish('bayrol/data', data, {}, () => {
      console.log('Daten erfolgreich an MQTT veröffentlicht.');
      client.end();
      browser.close();
    });
  });

  client.on('error', (err) => {
    console.error('MQTT Fehler:', err);
    client.end();
    browser.close();
  });
}

run().catch((err) => {
  console.error('FEHLER:', err);
});

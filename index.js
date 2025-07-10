import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import mqtt from 'mqtt';

puppeteer.use(StealthPlugin());

const USERNAME = process.env.BAYROL_USERNAME;
const PASSWORD = process.env.BAYROL_PASSWORD;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';

async function run() {
  console.log(`Starte mit Benutzer: ${USERNAME}`);
  console.log(`MQTT-Broker: ${MQTT_BROKER}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.bayrol-poolaccess.de/webview/', { waitUntil: 'networkidle2' });

  await page.type('#username', USERNAME);
  await page.type('#password', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  console.log('Login erfolgreich.');

  await page.goto('https://www.bayrol-poolaccess.de/webview/getdata.php?cid=49458', { waitUntil: 'networkidle2' });
  const data = await page.evaluate(() => document.body.innerText);
  console.log('Pooldaten:', data);

  const client = mqtt.connect(MQTT_BROKER);
  client.on('connect', () => {
    client.publish('bayrol/data', data, {}, () => {
      console.log('Daten an MQTT veröffentlicht.');
      client.end();
      browser.close();
    });
  });
}

run().catch(console.error);

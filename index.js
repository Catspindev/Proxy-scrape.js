const axios = require('axios');
const fs = require('fs');
const SocksProxyAgent = require('socks-proxy-agent');

const listFilePath = 'list.txt';
const outputFile = 'all_proxies.txt'; // New single file for all proxies
const concurrencyLimit = 5;

async function scrapeProxies() {
  try {
    const githubLinks = fs.readFileSync(listFilePath, 'utf-8').split('\n').filter(url => url.trim() !== '');
    const allProxies = [];
    const startTime = Date.now();

    for (const githubLink of githubLinks) {
      const response = await axios.get(githubLink);

      if (githubLink.includes('raw.githubusercontent.com')) {
        allProxies.push(...response.data.split('\n'));
      } else {
        const proxies = response.data.match(/\d+\.\d+\.\d+\.\d+:\d+/g);
        if (proxies) {
          allProxies.push(...proxies);
        }
      }
    }

    const validProxies = allProxies.filter(isValidProxy);
    const totalProxies = validProxies.length;
    let checkedProxies = 0;

    const promises = validProxies.map(async (proxy) => {
      if (!isProxyInFile(proxy, outputFile)) {
        await checkProxy(proxy, ['http', 'https', 'socks4', 'socks5']);
        fs.appendFileSync(outputFile, `${proxy}\n`);
      }

      checkedProxies++;
      const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
      const eta = calculateETA(elapsedTime, checkedProxies, totalProxies);
      console.clear(); // Clear the console to display ETA only
      console.log(`ETA: ${eta}`);

      await delay(2000);
    });

    await Promise.all(promises);

    console.clear(); // Clear the console at the end
    console.log(`ETA: Done!`);

  } catch (error) {
    console.error('Error scraping proxies:', error.message);
  }
}

function isValidProxy(proxy) {
  const parts = proxy.split(':');
  return parts.length === 2 && !isNaN(parts[1]);
}

function isProxyInFile(proxy, filename) {
  try {
    const content = fs.readFileSync(filename, 'utf-8');
    return content.includes(proxy);
  } catch (error) {
    return false;
  }
}

async function checkProxy(proxy, types) {
  try {
    // Commented out the log line to hide IP and port information
    // console.log(`Checking proxy: ${proxy}`);

    const results = await Promise.all(types.map(async (type) => {
      if (type === 'http' || type === 'https') {
        const protocol = type === 'http' ? 'http' : 'https';
        const response = await axios.get(`${protocol}://www.example.com`, {
          proxy: {
            host: proxy.split(':')[0],
            port: parseInt(proxy.split(':')[1]),
            protocol: protocol,
          },
          timeout: 6000,
        });
        return response.status === 200;
      } else if (type === 'socks4' || type === 'socks5') {
        const agent = new SocksProxyAgent(`${type}://${proxy}`);
        const response = await axios.get('https://www.example.com', { httpAgent: agent, timeout: 3000 });
        return response.status === 200;
      }

      return false; // Add more proxy types as needed
    }));

    return results.includes(true);

  } catch (error) {
    // Commented out the log line to hide IP and port information
    // console.log(`Proxy failed: ${error.message}`);
    return false;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateETA(elapsedTime, checkedProxies, totalProxies) {
  if (checkedProxies === 0) {
    return '00:00:00';
  }

  const averageTimePerProxy = elapsedTime / checkedProxies;
  const remainingProxies = totalProxies - checkedProxies;
  const remainingTime = remainingProxies * averageTimePerProxy;

  const hours = Math.floor(remainingTime / 3600);
  const minutes = Math.floor((remainingTime % 3600) / 60);
  const seconds = Math.floor(remainingTime % 60);

  const pad = (num) => (num < 10 ? '0' : '') + num;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

scrapeProxies();

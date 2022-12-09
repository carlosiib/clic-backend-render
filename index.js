
const express = require("express");
const app = express();
const fetch = require('node-fetch');
const cors = require('cors');
const bodyParser = require('body-parser');
const parseLinks = require('parse-links');
const puppeteer = require('puppeteer');
const dotenv = require('dotenv')
dotenv.config()
const port = process.env.PORT ?? 5000;

/* 
 * ENDPOINTS
 * DEV - "http://localhost:5000/"
 * -PRODUCTION FRONT - https://clic-readers-wholesale.netlify.app
 * PRODUCTION  BACK - "https://clic-backend-render.onrender.com/"
 */

app.use(cors({
  origin: "http://localhost:3000"
}))


const jsonParser = bodyParser.json()
// const urlencodedParser = bodyParser.urlencoded({ extended: false })

/*const CUSTOMERS_URL = process.env.CUSTOMERS_URL;
const USER_URL = process.env.USER_URL;
const ACTIVATION_URL = process.env.ACTIVATION_URL;*/

const CUSTOMERS_URL = 'https://c1d75c3ba3b0befea38d7a84700201fb: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@clic-readers-wholesale1.myshopify.com/admin/api/2019-10/customers.json?limit=30';

const USER_URL = 'https://c1d75c3ba3b0befea38d7a84700201fb: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@clic-readers-wholesale1.myshopify.com/admin/api/2019-10/customers/';

const ACTIVATION_URL = 'https://c1d75c3ba3b0befea38d7a84700201fb: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@clic-readers-wholesale1.myshopify.com/admin/api/2019-10/customers/'


app.get('/', async (req, res) => {
  let arr = []
  let paginationURLS = []

  function fetchNextJson(url) {
    let next = ""
    let linkHeader = ""
    return fetch(url)
      .then((response) => {
        const json = response.json()

        linkHeader = parseLinks(response.headers.get('link'))
        if (!linkHeader.next) {
          const finalSearch = paginationURLS.pop()
          const finalURl = `${CUSTOMERS_URL}&page_info=${finalSearch}`
          return fetch(finalURl)
            .then(pars => pars.json())
            .then(data => arr.push(...data.customers))
        }

        const current_url = new URL(linkHeader.next)
        const search_params = current_url.searchParams;
        const id = search_params.get('page_info')
        paginationURLS.push(id)
        next = `${CUSTOMERS_URL}&page_info=${id}`
        return json;

      })
      .then((data) => {
        if (next) {
          arr.push(...data.customers)
          return fetchNextJson(next)
        } else {
          return arr
        }

      })
      .catch(function (err) {
        console.log('error: ' + err);
      });
  }


  fetchNextJson(CUSTOMERS_URL).then(function (resApi) {
    res.json(arr)
  })

  // const data = await fetch(CUSTOMERS_LENGTH_URL)
  // const length = await data.json()
  // res.json(length)

})

/* Update customer password */
//http://localhost:3000/update
app.put("/update", jsonParser, async (req, res) => {
  const { password, id } = req.body
  console.log("/update data", password, id)

  //PUT - Shopify ADMIN API
  payload = {
    "customer": {
      "id": id
    }
  }
  console.log(`${USER_URL}${id}.json`)
  console.log("payload", payload)


  try {
    await fetch(`${USER_URL}${id}.json`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Origin": "*"
      },
      "body": JSON.stringify(payload)
    })


    /* POST -> Get activation URL */
    const activation_endpoint = `${ACTIVATION_URL}${id}/account_activation_url.json`
    console.log("activation endpoint", activation_endpoint)
    const request_url = await fetch(activation_endpoint, {
      method: "POST"
    })
    const response_url_data = await request_url.json()
    const response_url = response_url_data.account_activation_url
    console.log("activation url", response_url)

    /* PUPPETEER  */
    console.log("begin puppeeter")
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(response_url);
    await page.type('#CreatePassword', password)
    await page.type('#CustomerPasswordConfirmation', password)

    await Promise.all([
      page.waitForNavigation(),
      page.click('#active_account__btn')
    ])

    await browser.close()
    console.log("end puppeeter")

    /* GET - CUSTOMER UPDATED DATA */
    const updatedUser = await fetch(`${USER_URL}${id}.json`)
    const updatedUserData = await updatedUser.json()
    console.log(updatedUserData.customer)
    return res.status(200).send(updatedUserData.customer)
  } catch (error) {
    console.log(error)
    res.send(error)
  }



})

app.listen(port, () => console.log(`App Listening on port ${port}!`));

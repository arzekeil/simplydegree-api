/* index.js
Jessie Newman
Last Updated: 2022-03-27
*/
/*
Current Status:
Everything other than tasks is ready to go, except for:
* Not sure whether to/how to translate the data sent from the frontend to the MongoDB
* Unsure if user authentication function properly interfaces with user API
* Copy and slightly modify event functions for tasks once confirmed working
* Prof has high expectations for code documentation
*/

// Imports (requirements)
const express = require('express')
const MongoClient = require('mongodb').MongoClient
const {readFileSync} = require('fs');
const path = require('path');
const app = express()
const http = require('http');
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// Global constants
const port = 3000
const file_name = "secret.txt"
const authApiHost = "example.com"
const authApiPath = "/somepath"
const doAuthCheck = false

// initializing collections with global context
var courseCol
var eventCol
var taskCol

// fetching credentials from secret.txt
var creds
try {
  file = readFileSync(path.join(__dirname, file_name))
  creds = file.toString()
}
catch(err) {
  console.log(err)
  stop()
}
const uri = "mongodb+srv://" + creds + "@cluster0.raicx.mongodb.net/simply-degree?retryWrites=true&w=majority";

function userVerify(userID, req, callback) {
  if(!doAuthCheck)
    callback(true)
  // call the user API to verify this is the claimed user
  const options = {
    host: authApiHost,
    port: 80,
    path: authApiPath,
    method: 'GET',
    headers: req.headers['Authorization']
  }
  valid = false
  httpreq = http.request(options, (res) => {
    res.setEncoding("utf-8")
    res.on('data', (body) => {
      body = JSON.parse(body)
      try {
        valid = Boolean(body['valid'])
      } catch (error) {
        console.log("ERROR: could not find 'valid' field in response body")
      }
    })
    res.on('end', () => {
      callback(valid);
    })
  })
  httpreq.write({'userID': userID})
  httpreq.end()
}

// connect to the MongoDB
MongoClient.connect(uri, (err, client) => {
    if (err) throw err

    const db = client.db('simply-degree')
    courseCol = db.collection('courses')
    eventCol = db.collection('events')
    taskCol = db.collection('tasks')
    
})



/* --- COURSES --- */
app.get('/courses/:courseID', (req, res) => {
  id = req.params.courseID
  // attempt to get document matching this courseID
  result = courseCol.findOne({'course_id':id})
  result.then(data => {
    if(data) {
      res.status(200).send(JSON.stringify(data))
    }
    else {
      res.status(404).send("Course ID " + id + " was not found.")
    }
  })
  .catch(err => {
    throw err;
  })
 
})

app.get('/courses/prereq/:courseID1/:courseID2', (req, res) => {
  id1 = req.params.courseID1
  id2 = req.params.courseID2

  course1 = null
  course2 = null

  // get the first course from the database
  result = courseCol.findOne({'course_id':id1})
  result.then(course1 => {
    // if course1 was returned
    if(course1) {
      // get the second course from the database
      result = courseCol.findOne({'course_id':id2})
      result.then(course2 => {
        // if course2 was returned
        if(course2) {
          // if one's id is found in the other's prereq_arr, return True
          if(course1.course_prereq_arr.includes(id2) || course2.course_prereq_arr.includes(id1)) {
            res.status(200).send(true)
          }
          else {
            res.status(200).send(false)
          }
        }
        // Course 2 was not found
        else {
          res.status(404).send("Course ID " + id2 + " was not found.")
        }
      })
    }
    // Course 1 was not found
    else {
      res.status(404).send("Course ID " + id1 + " was not found.")
    }
  })
  // some error occurred
  .catch(err =>{
    throw err;
  })
})

/* --- EVENTS --- */
// Return all events associated with a user in this year and month
app.get('/events/:userID/:year/:month', (req, res) => {
  // validate user first
  userVerify(req.params.userID, req, (valid) => {
    if(!valid) {
      res.status(403).send("Error: not authorized")
      return;
    }
    result = [] // initialize as empty array
    // getting params
    id = req.params.userID
    year = req.params.year
    month = req.params.month
    // finding start time and end time of this month
    timeStart = new Date(year, month)
    timeEnd = new Date(year, month + 1) - 1 // start of next month, minus 1 millisecond

    // find events for this user that start sometime before the end of this month,
    // and end sometime after the start of this month
    cursor = eventCol.find({"user_id":id, "event_start":{"$lte":timeEnd}, "event_end":{"$gte":timeStart}})
    cursor.forEach(doc => {
      // for every document matching the conditions:
      console.log(doc)
      result.push(doc)
    }, (err) => {
      // when done or an error occured:
      if(err) {
        console.log(err)
        res.status(500).send("An error occured")
      }
      else {
        res.status(200).send(JSON.stringify(result))
      }
    })
  })
})

// Post a new event to the database
// NOTE: currently does NOT auth the user,
// nor format the json to the fieldnames we want in the db.
app.post('/events/:userID/new', (req, res) => {
  userVerify(req.params.userID, req, (valid) => {
    if(!valid) {
      res.status(403).send("Error: not authorized")
      return;
    }
    console.log(req.body)
    eventCol.insertOne(req.body, (err) => {
      if(err) {
        res.status(500).send("Failed to POST")
      }
      else {
        res.status(200).send("OK")
      }
    })
  })
})

// Update an event
// NOTE: like new, 
app.put('/events/:userID/update', (req, res) => {
  userVerify(req.params.userID, req, (valid) => {
    if(!valid) {
      res.status(403).send("Error: not authorized")
      return;
    }
    eventCol.updateOne({"$set":req.body}, (err) => {
      if(err) {
        res.status(500).send("Failed to PUT")
      }
      else {
        res.status(200).send("OK")
      }
    })
  })
})

// Delete an event from the database
// Assumes the Authorization header contains a JavaWebToken (JWT)
app.delete('/events/:userID/:eventID', (req, res) => {
  userVerify(req.params.userID, req, (valid) => {
    if(!valid) {
      res.status(403).send("Error: not authorized")
      return;
    }
    uid = req.params.userID
    eid = req.params.eventID

    eventCol.deleteOne({'user_id':uid, 'event_id':eid}, (err) => {
      if(err) {
        res.status(500).send("Failed to DELETE")
      }
      else {
        res.status(200).send("OK")
      }
    })
  })
})

/* --- TASKS --- */
// [copy and slightly modify events functions when they are fully complete]

/* Start listening */
app.listen(port, () => {
  console.log(`Now listening on port ${port}`)
})
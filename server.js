const express = require('express')
const app = express()
const bodyParser = require('body-parser')
var mongo = require('mongodb');
var shortid = require('shortid');
var moment = require('moment');
const cors = require('cors')

const mongoose = require('mongoose')

mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

//Where my work starts.

//Going to create a fitUser schema here.  Leaving the array blank - this is going to be an array objects for exercises later.
var Schema = mongoose.Schema;

var fitUserSchema = new Schema({
  //We're overriding the default _id here to match the assignment.  This can be done by identifying a type and leaving the rest blank.
  _id: String,
  username: { type: String, required: true, unique: true },
  fitness: Array
})

var fitUser = mongoose.model("fitUser", fitUserSchema);


app.post("/api/exercise/new-user", function (req, res) {
  //Here we're going to generate a shortID using shortid.  This was provided by the assignment and matches their own blueprint example.
  var uID = shortid.generate();
  fitUser.find({username: req.body.username}, function (err, data) {
    if (!data.length) {
      //Here we're creating the fit user.  Note that we supply the shortID here rather than in the schema blueprint.
      //We do this because this is an asynchronous function, and we need to supply it in our reply - which doesn't work out well in the same call.
      console.log("No data found, good to proceed.")
      fitUser.create({
      _id: uID,
      username: req.body.username
  }, function (err, data) {
    if (err) {
      console.log(err.errmsg)
      res.send("Something went wrong - please try again..")
    }
    else {
         console.log("Successfully added user.")
         res.json({"username": req.body.username, "_id": uID})
         };
  })
    }
    else {
      console.log("Entry found - alerting user..")
      res.send("Username already taken - please choose another.");
    }
  });
})

app.post("/api/exercise/add", function (req, res) {
  var uID = req.body.userId
  var descVal = req.body.description
  var durVal = req.body.duration
  var dateVal = req.body.date
  
  //Here we're using moment to make the date formats predictable.  The HTML form was modified in my assignment to a date field, so if it's left default moment will simply use today's date.
  dateVal === "" ? dateVal = moment().format("MM-DD-YYYY") : dateVal = moment(dateVal).format("MM-DD-YYYY")
  
  //Here, the array we established earlier will be populated by an array of objects, each with the three desired properties.
  //This can be achieved through findOneAndUpdate and simply pushing the values into fitness as they come in.
  fitUser.findOneAndUpdate({_id: uID}, {$push: {fitness: {description: descVal, duration: durVal, date: dateVal}}}, {new: true}, function (err, data) {
    if (err) {
      console.log("Error occured.")
      res.send("An error occured, please report this to your administrator.")
    }
    //Here is where I'm handling no ID found.  Simple true or false for data.
    else if (!data) {
      console.log("No entry found.")
      res.send("Entry not found, please enter a valid user ID.")
    }
    else {
      res.json({username: data.username, id: uID, description: descVal, duration: durVal, date: dateVal});
      //{"username":"hello","description":"asdfsdaf","duration":30,"_id":"BkP-DPnHe","date":"Sat Aug 03 2019"}
    }
  })
})

app.get("/api/exercise/users", function (req, res) {
  //For this part of the assignment, I'm mapping and returning the object values in a more readable format.
  //Users and ID only - no exercise data in this part.
  fitUser.find({}, function (err, data) {
    if (err) {
      console.log("An error occured.")
      res.send("An error has occured - please contact your administrator for more asistance.")
    }
    else {
      var mapData = data.map( (x) => "ID: " + x._id + " Username: " + x.username)
      res.send(mapData)
      }
  })
  
})

app.get("/api/exercise/log", function (req, res) {
  //Gather the param data assigned here: ?{userID}[&from][&to][&limit]
  var uID = req.query.userID
  //In our dates, if they're undefined we're leaving them that way due to checks later.  If they're not, we're converting them to match our database format for dates.
  var fromID = req.query.from
  fromID === undefined ? fromID : fromID = moment(fromID).format("MM-DD-YYYY")
  var toID = req.query.to
  toID === undefined ? toID : toID = moment(toID).format("MM-DD-YYYY")
  var limitID = req.query.limit
  
  //res.send("Please enter ?userID=&from=&to=&limit for more options.")
  //I'm starting the find here - I didn't want to use the same code for a find several times per situation, so I find (and fail if no ID found) at the very top.
  fitUser.find({_id: uID}, function (err, data) {
    if (err) {
          console.log(err.errmsg)
          res.send("Something went wrong - please contact your administrator asap.")
        }
    else if (!data.length) {
          console.log("No entry found.")
          res.send("User not found - please enter a valid ID.")
        }
    else {
      switch (true) {
          //I start from the top using a switch case.  This is so no goofy conditionals need to be coded in repeatedly 
          //(eg, the uID and fromID part, you'd have to specify the other values are undefined explicitly or it'd be evaluated every time.)
        case (uID !== "undefined" && fromID !== undefined && toID !== undefined && limitID !== undefined): {
          //This is some input protection since these are browser based params.  If params we DON'T want are entered we'll return the default user object and break.
          //I have these checks on each switch case (based on the params entered).
          if (moment(fromID).isValid() === false || moment(toID).isValid() === false || isNaN(limitID) === true) {
            console.log("Data entered is not valid - returning default data.")
            res.json({_id: data[0]._id, username: data[0].username, log: data[0].fitness, count: data[0].fitness.length})
            break;
          }
          else {
            console.log("Data found with all parameters specified - here it is!")
            //Some easy array magic here.  Moment makes it easy to reliably compare dates as well.
            var fitMap = data[0].fitness.filter( x => moment(x.date).isAfter(fromID, 'day') && moment(x.date).isBefore(toID, 'day')).slice(0, limitID)
            res.json({_id: data[0]._id, username: data[0].username, log: fitMap, count: fitMap.length})
            break;
          }
        }
          case (uID !== "undefined" && fromID !== undefined && toID !== undefined): {
          if (moment(fromID).isValid() === false || moment(toID).isValid() === false) {
            console.log("Data entered is not valid - returning default data.")
            res.json({_id: data[0]._id, username: data[0].username, log: data[0].fitness, count: data[0].fitness.length})
            break;
          }
          else {
            console.log("Data found with from and to - here it is!")
            //Again, moment does all the work for me here, cutting out the need to loop or sort and able to partner with filter.
            var fitMap = data[0].fitness.filter( x => moment(x.date).isAfter(fromID, 'day') && moment(x.date).isBefore(toID, 'day'))
            res.json({_id: data[0]._id, username: data[0].username, log: fitMap, count: fitMap.length})
            break;
          }
      }
        case (uID !== "undefined" && fromID !== undefined): {
          if (moment(fromID).isValid() === false) {
            console.log("Data entered is not valid - returning default data.")
            res.json({_id: data[0]._id, username: data[0].username, log: data[0].fitness, count: data[0].fitness.length})
            break;
          }
          else {
            console.log("Data found with from included - here it is!")
            //There's a trend here, the return gets simpler and simpler as we trend down the switch case.
            var fitMap = data[0].fitness.filter( x => moment(x.date).isAfter(fromID, 'day'))
            res.json({_id: data[0]._id, username: data[0].username, log: fitMap, count: fitMap.length})
            break;
          }
      }     
        default: {
          //We can make our default return the return user object as specified in the assignment.  EG, no params? Here's the user object, all exercises!
          console.log("Returning default ID string.")
          res.json({_id: data[0]._id, username: data[0].username, log: data[0].fitness, count: data[0].fitness.length})
          break;
        }
  }
    }
  }
)
})

// Not found middleware
//Note from Jake - I really liked this check and the one that preceeds, I just moved it below my work.
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

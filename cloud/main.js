var stripe = require("stripe")(
    "sk_test_A9QMRVzF28BbkDdEDBlo8JhH"
);
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.define('requestCharge', function(req, res){
  console.log(req);
  var query = new Parse.Query("Requests");
  query.get(req.params.objectId, {
    success: function(result) {
      if (result.get("pickup_time") != null && result.get("completed_time") != null) {
        var pickupDate = new Date(result.get("pickup_time"));
        var utcPickupHours = pickupDate.getUTCHours() + (pickupDate.getUTCMinutes() / 60);
        var completionDate = new Date(result.get("completed_time"));
        var utcCompletionDateHours = completionDate.getUTCHours() + (completionDate.getUTCMinutes() / 60);
        var difference = utcCompletionDateHours - utcPickupHours;
        res.success({"charge":difference*100});
      } else {
        res.error("pickup time or completed time not set");
      }
    },

    error: function(error) {
      res.error(error);
    }
  });
  // if (req.params.objectId != null) {
  //   console.log(req.params.objectId);
  // }
  // query.equalTo("objectId", req.params.objectId);
  // query.find({
  //   success: function(result) {
  //     if (result.length)
  //     res.success(result[0]);
  //   },
  //
  //   error: function(error) {
  //     res.error(error);
  //   }
  // });

});

Parse.Cloud.define('pickupRequest', function(request, response) {
  // to ensure fairness we allow the server to set timestamps for pickup and delivery of people.
  // prevents users from manipulating timestamps by changing devices time

  // parameters:
  // 1. request ID
  // 2. captain object id

  var params = request.params;
  // find the request by ID
  var RequestClass = Parse.Object.extend("Request");
  var request = new RequestClass();

  var query = new Parse.Query(request)
  query.get(params.objectId, {
    success: function(object) {
      console.log(object);
      // verify request not canceled
      console.log(object.captain);
      if (object.get("cancelled") == true || object.get("captain") != null) {
        response.error("Request was cancelled or has already been picked up by another captain");
      } else {
        // request not cancelled and doesn't have a captain
        var findCaptainQuery = new Parse.Query(Parse.User);
        findCaptainQuery.get(params.captainId, {
          success: function(user) {
            object.set("captain", user);
            object.set("pickup_time", new Date());
            object.save(null, {
              success: function(object) {
                response.success(object)

              },
              error: function(error) {
                response.error(error);
              }
            });
          },
          error: function(error) {
            response.error("Captain does not exist " + params.captainId);
          }
        });
      }
    },
    error: function(error) {
      response.error(error);
    }
  });

});

Parse.Cloud.define('createCharge', function(request, response) {

});

Parse.Cloud.define('createCustomer', function(request, response){
  Parse.Cloud.useMasterKey();
  var params = request.params;
  if(params.objectId != null && params.exp_month != null, params.exp_year != null, params.number != null, params.cvc != null) {
    var query = new Parse.Query(Parse.User);
    query.get(params.objectId, {
      success: function(user) {
        // user retrieved check for current card
        if(user.default_card == null) {
          // customer doesn't have card create them and add card
          stripe.customers.create({
            id:params.objectId,
            source: {
              object:"card",
              exp_month:params.exp_month,
              exp_year:params.exp_year,
              number:params.number,
              cvc:params.cvc
            }
          }, function(error, customer){
            if (error == null) {
              user.set("default_card", customer.default_source);
              user.set("card", customer.sources.data[0].last4);
              user.save(null, {
                success: function(user) {
                  response.success({"customer":customer, "user":user});
                },
                error: function(error) {
                  response.error(error);
                }
              });
            } else {
              // error try update customer
              stripe.customers.update(params.objectId, {
                source: {
                  object:"card",
                  exp_month:params.exp_month,
                  exp_year:params.exp_year,
                  number:params.number,
                  cvc:params.cvc
                }
              }, function(error, customer){
                if (error == null) {
                  user.set("default_card", customer.default_source);
                  user.set("card", customer.sources.data[0].last4);
                  user.save(null, {
                    success: function(user) {
                      response.success({"customer":customer, "user":user});
                    },
                    error: function(error) {
                      response.error(error);
                    }
                  });

                } else {
                  response.error(error);
                }
              });
            }
          });
        } else {
          // update default card for user
          stripe.customers.update(params.objectId, {
            source: {
              object:"card",
              exp_month:params.exp_month,
              exp_year:params.exp_year,
              number:params.number,
              cvc:params.cvc
            }
          }, function(error, customer){
              if (error == null) {
                // update user
                user.set("default_card", customer.default_source);
                user.set("card", customer.sources.data[0].last4);
                user.save(null, {
                  success: function(user) {
                    response.success({"customer":customer, "user":user});
                  },
                  error: function(error) {
                    response.error(error);
                  }
                });
              }
          });
        }
      },
      error: function(error) {
        response.error("User with ID " + params.objectId + " does not exist!");
      }
    });
  } else {
      response.error("Required parameter not met");
  }
});

Parse.Cloud.define('requestChargeEstimate', function(request, response){

});
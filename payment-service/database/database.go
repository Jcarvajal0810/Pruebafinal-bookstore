﻿package database
import ("context";"log";"os";"time";"go.mongodb.org/mongo-driver/mongo";"go.mongodb.org/mongo-driver/mongo/options")
var Client *mongo.Client
var PaymentsCollection *mongo.Collection
func Connect() {
mongoURI := os.Getenv("MONGO_URI")
if mongoURI == "" {log.Fatal("MONGO_URI not set")}
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
if err != nil {log.Fatal(err)}
if err = client.Ping(ctx, nil); err != nil {log.Fatal(err)}
Client = client
PaymentsCollection = client.Database("paymentdb").Collection("payments")
log.Println("Connected to paymentdb")
}

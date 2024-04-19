// src/index.mjs
import express from "express";
import http from "http";
import {Server, Socket} from "socket.io";
import {IUser} from "./types";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true,
  },
});

const users_list: IUser[] = [];

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("user_connected", (data) => {
    console.log("user_connected");
    const existingUser = users_list.find((user) => user.address === data);
    if (existingUser) {
      existingUser.id = socket.id;

      return;
    }

    const user = {
      id: socket.id,
      address: data,
      online: true,
      busy: false,
      open: true,
      connectedPeer: "",
    };
    users_list.push(user);
    socket.broadcast.emit("active_users_count", users_list.length);
  });
  // when the user wants to set them as active or inactive
  socket.on("status_toggle", (status) => {
    const user = users_list.find((user) => user.id === socket.id);
    if (user) {
      user.open = status;
    }
  });

  // when the user calls
  socket.on("find_a_peer", () => {
    console.log("find_a_peer", socket.id);
    const user = users_list.find((user) => user.id === socket.id);

    // check if the user wallet address is valid
    if (!user) {
      console.log("Invalid User");
      socket.emit("Invalid User");
      return;
    }

    // check if the user is busy
    if (user.busy) {
      console.log("you_are_busy");
      socket.emit("you_are_busy");
      return;
    }

    const users_looking_for_peer = users_list.filter(
      (user) => user.id !== socket.id && user.open && !user.busy && user.online
    );

    // check if there is any user looking for a peer
    if (users_looking_for_peer.length === 0) {
      console.log("no_peer_found");
      socket.emit("no_peer_found");
      return;
    }

    // get the first user looking for a peer
    console.log("peer_found", users_looking_for_peer[0].address);
    socket.emit("peer_found", users_looking_for_peer[0].address);
  });

  // when the user receives peer_found event, they will then send a chat_request to the given peer. Once done, emits chat_request_sent event
  socket.on("chat_request_sent", (data) => {
    const sender = users_list.find((user) => user.id === socket.id);
    const peer = users_list.find((user) => user.address === data);
    if (peer && sender) {
      socket.to(peer.id).emit("incoming_chat_request", sender.address);
    }
  });

  // wen the user accepts the chat request, they shoudl start a video call, they will emit chat_request_accepted event
  socket.on("chat_request_accepted_and_video_request_sent", (data) => {
    const sender = users_list.find((user) => user.id === socket.id);
    const peer = users_list.find((user) => user.address === data);

    if (sender && peer) {
      socket.to(peer.id).emit("incoming_video_request", sender.address);
    }
  });

  // when the user accepts the video call, they will emit video_call_accepted event
  socket.on("video_call_accepted", (data) => {
    const sender = users_list.find((user) => user.id === socket.id);
    const peer = users_list.find((user) => user.address === data);

    if (sender && peer) {
      sender.busy = true;
      peer.busy = true;
      sender.connectedPeer = peer.address;
      peer.connectedPeer = sender.address;
      sender.open = false;
      peer.open = false;
      socket.emit("call_established", peer.address);
      socket.to(peer.id).emit("call_established", sender.address);
    }
    socket.broadcast.emit("active_users_count", users_list.length);
  });

  // when the user ends the call, they will emit the disconnect event
  socket.on("disconnect_call", (data) => {
    const sender = users_list.find((user) => user.id === socket.id);
    const peer = users_list.find((user) => user.address === data);

    if (sender && peer) {
      sender.busy = false;
      peer.busy = false;
      sender.connectedPeer = "";
      peer.connectedPeer = "";
      sender.open = true;
      peer.open = true;
      socket.emit("call_ended", peer.address);
      socket.to(peer.id).emit("call_ended", sender.address);
    }
  });

  socket.on("logout", () => {
    const user = users_list.find((user) => user.id === socket.id);
    if (user) {
      users_list.splice(users_list.indexOf(user), 1);
      socket.broadcast.emit("active_users_count", users_list.length);
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    const user = users_list.find((user) => user.id === socket.id);
    if (user) {
      users_list.splice(users_list.indexOf(user), 1);
      socket.broadcast.emit("active_users_count", users_list.length);
    }
  });
});

function logUsers() {
  console.log("-------------------Connected Users:--------------------------");
  console.log("Total users: ", users_list.length);

  users_list.forEach((user) => {
    console.log(user);
  });
  console.log("-------------------------------------------------------------");
}

// Schedule the logUsers function to run every 10 seconds
setInterval(logUsers, 10000); // 10000 milliseconds = 10 seconds

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

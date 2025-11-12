import React from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Dashboard() {
  const handleSearch = async (city) => {
    // Your code that fetches data
    // ...
    toast.success(`Data for ${city} is updated! 🌾`, {
      position: "top-center",
      autoClose: 3000,
    });
  };

  return (
    <div>
      {/* Your UI code */}
      <ToastContainer />
    </div>
  );
}

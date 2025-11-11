import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true, // ✅ make phone unique instead
  },
  email: {
    type: String,
    default: null, // ✅ no longer required
  },
  password: {
    type: String,
    required: true,
  },
});

export default mongoose.model("User", userSchema);

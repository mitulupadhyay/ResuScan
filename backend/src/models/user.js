const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"],
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    onboarding: {
      targetRole: { type: String, trim: true, maxlength: 80, default: "" },
      experienceLevel: { type: String, enum: ["", "beginner", "academic_projects", "internships", "other"], default: "" },
      goal: { type: String, enum: ["", "analyze", "tailor", "improve_projects", "from_scratch"], default: "" },
      jobDescription: { type: String, maxlength: 15000, default: "" },
      completedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);

import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://aadithyanmerin:AdithyanMerin@cluster0.syz6u.mongodb.net/Outfilo");
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err);
    
  }
};

export default connectDB;
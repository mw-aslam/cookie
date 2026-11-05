// Модель пользователя в MongoDB.
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Чем больше «раундов», тем медленнее и надёжнее хэш. 12 — разумный баланс.
const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // MongoDB создаст уникальный индекс: два аккаунта с одним email невозможны
      lowercase: true,
      trim: true,
    },
    // Здесь хранится ТОЛЬКО bcrypt-хэш, никогда не сам пароль.
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true } // createdAt / updatedAt
);

// Хэширует пароль и записывает результат в passwordHash.
userSchema.methods.setPassword = async function setPassword(plainPassword) {
  this.passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
};

// Сравнивает введённый пароль с хэшем из базы.
userSchema.methods.checkPassword = function checkPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

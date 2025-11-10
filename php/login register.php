<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
session_start();
include "config.php"; // pastikan $db sudah berupa PDO atau MySQLi yang valid

// === REGISTER ===
if (isset($_POST['register'])) {
    $nama     = trim($_POST['name']);
    $email    = trim($_POST['email']);
    $password = trim($_POST['password']);

    // Hash password
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    // Cek apakah email sudah ada
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);

    if ($stmt->rowCount() > 0) {
        echo "<script>alert('Email sudah terdaftar, silakan login!'); window.location='login page.php';</script>";
        exit;
    } else {
        $stmt = $db->prepare("INSERT INTO users (nama, email, password) VALUES (?, ?, ?)");
        if ($stmt->execute([$nama, $email, $passwordHash])) {
            echo "<script>alert('Registrasi berhasil! Silakan login.'); window.location='login page.php';</script>";
            exit;
        } else {
            echo "<script>alert('Terjadi kesalahan saat registrasi!'); window.history.back();</script>";
            exit;
        }
    }
}

// === LOGIN ===
if (isset($_POST['login'])) {
    $email    = trim($_POST['email']);
    $password = trim($_POST['password']);

    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['nama'];
        echo "<script>alert('Login berhasil!'); window.location='index.html';</script>";
        exit;
    } else {
        echo "<script>alert('Email atau password salah!'); window.history.back();</script>";
        exit;
    }
}
?>

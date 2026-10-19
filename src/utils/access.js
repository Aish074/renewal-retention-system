const isAdmin = (user) => user.role === 'ADMIN';

module.exports = { isAdmin };
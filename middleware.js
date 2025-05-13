function requireLogin(req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    next();
  }
  
  function requireAdmin(req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (req.session.user.user_type !== 'admin') {
      return res.status(403).render('403', { user: req.session.user });
    }
    next();
  }
  
  module.exports = {
    requireLogin,
    requireAdmin
  };
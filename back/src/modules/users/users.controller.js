const { body } = require("express-validator");
const prisma = require("../../config/database");
const { MODULES, permissionsToLevel } = require("../../middleware/moduleRegistry");
const { PERMISSIONS } = require("../../middleware/rbac");
const { activityFromReq } = require("../../services/activityLogger");
const usersService = require("./users.service");

const roleValidation = body("role").isString().isLength({ min: 4, max: 20 });
const activeValidation = body("actif").isBoolean();

async function listUsers(req, res, next) {
  try {
    const result = await usersService.listUsers({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function listPendingUsers(req, res, next) {
  try {
    const items = await usersService.listPendingUsers({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
    });
    return res.json(items);
  } catch (error) {
    return next(error);
  }
}

async function approveUser(req, res, next) {
  try {
    const updated = await usersService.approveUser({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      callerId: req.user.id,
      targetUserId: req.params.id,
      req,
    });
    await activityFromReq(req, {
      action: "UPDATE",
      module: "admin",
      entity: "Utilisateur",
      entityId: updated.id,
      entityLabel: `Compte approuvé: ${updated.prenom} ${updated.nom}`,
    });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

async function rejectUser(req, res, next) {
  try {
    const updated = await usersService.rejectUser({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      callerId: req.user.id,
      targetUserId: req.params.id,
      req,
    });
    await activityFromReq(req, {
      action: "UPDATE",
      module: "admin",
      entity: "Utilisateur",
      entityId: updated.id,
      entityLabel: `Compte rejeté: ${updated.prenom} ${updated.nom}`,
    });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const updated = await usersService.changeUserRole({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      callerId: req.user.id,
      targetUserId: req.params.id,
      role: req.body.role,
      req,
    });
    await activityFromReq(req, {
      action: "UPDATE",
      module: "admin",
      entity: "Utilisateur",
      entityId: updated.id,
      entityLabel: `Rôle modifié → ${req.body.role}`,
    });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const updated = await usersService.changeUserStatus({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      callerId: req.user.id,
      targetUserId: req.params.id,
      actif: req.body.actif,
      req,
    });
    await activityFromReq(req, {
      action: "UPDATE",
      module: "admin",
      entity: "Utilisateur",
      entityId: updated.id,
      entityLabel: req.body.actif ? "Compte réactivé" : "Compte désactivé",
    });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

async function resetUserPassword(req, res, next) {
  try {
    const result = await usersService.resetUserPassword({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      callerId: req.user.id,
      targetUserId: req.params.id,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function sendUserInvitation(req, res, next) {
  try {
    const result = await usersService.sendUserInvitation({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      callerId: req.user.id,
      targetUserId: req.params.id,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const created = await usersService.createUser({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      callerId: req.user.id,
      payload: {
        nom: req.body.nom,
        prenom: req.body.prenom,
        email: req.body.email,
        motDePasse: req.body.motDePasse,
        role: req.body.role,
        telephone: req.body.telephone,
        forceChangeOnFirstLogin: req.body.forceChangeOnFirstLogin !== false,
        sendInviteEmail: Boolean(req.body.sendInviteEmail),
      },
      req,
    });
    await activityFromReq(req, {
      action: "CREATE",
      module: "admin",
      entity: "Utilisateur",
      entityId: created.id,
      entityLabel: `Utilisateur créé: ${created.prenom} ${created.nom}`,
    });
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

async function auditLog(req, res, next) {
  try {
    const result = await usersService.listAuditLog({
      societeId: req.user.societeId,
      userId: req.query.userId,
      action: req.query.action,
      entite: req.query.entite,
      from: req.query.from,
      to: req.query.to,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    const kpis = await usersService.getAuditKpis(req.user.societeId);
    return res.json({ ...result, kpis });
  } catch (error) {
    return next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await usersService.getMe(req.user.id);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const updated = await usersService.updateMyProfile(req.user.id, req.body);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

async function getMyAudit(req, res, next) {
  try {
    const limit = req.query.limit ?? 10;
    const items = await usersService.getMyAudit(req.user.id, limit);
    return res.json(items);
  } catch (error) {
    return next(error);
  }
}

async function uploadMyAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "Image requise" });
    const url = `/uploads/avatars/${req.file.filename}`;
    const updated = await usersService.updateAvatar(req.user.id, url);
    return res.json({ url, user: updated });
  } catch (error) {
    return next(error);
  }
}

async function getUserPermissions(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    let user;
    try {
      user = await usersService.trouverUtilisateurPourAppelant({
        id,
        callerRole: req.user.role,
        callerSocieteId: req.user.societeId,
      });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ message: "Utilisateur introuvable" });
      throw error;
    }

    if (user.role === "SUPER_ADMIN") {
      return res.json({
        role: user.role,
        isSuperAdmin: true,
        modules: MODULES.map((m) => ({
          ...m,
          niveauRole: "validation",
          niveauActuel: "validation",
          isOverride: false,
        })),
      });
    }

    const overrides = await prisma.permissionOverride.findMany({ where: { utilisateurId: id } });
    const overrideMap = Object.fromEntries(overrides.map((o) => [o.module, o.niveau]));
    const rolePerms = PERMISSIONS[user.role] || [];

    const modules = MODULES.map((m) => ({
      ...m,
      niveauRole: permissionsToLevel(m.key, rolePerms),
      niveauActuel: overrideMap[m.key] || permissionsToLevel(m.key, rolePerms),
      isOverride: Boolean(overrideMap[m.key]),
    }));

    res.json({ role: user.role, isSuperAdmin: false, modules });
  } catch (err) {
    next(err);
  }
}

async function updateUserPermissions(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const result = await usersService.updateUserPermissionOverrides({
      targetUserId: id,
      overrides: req.body.overrides,
      callerId: req.user.id,
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      req,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function patchUserPermissionsJson(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const result = await usersService.patchUserPermissions({
      targetUserId: id,
      permissions: req.body.permissions,
      callerId: req.user.id,
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      req,
    });

    await activityFromReq(req, {
      action: "UPDATE",
      module: "admin",
      entity: "Utilisateur",
      entityId: id,
      entityLabel: `Permissions personnalisées mises à jour`,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    let user;
    try {
      user = await usersService.trouverUtilisateurPourAppelant({
        id,
        callerRole: req.user.role,
        callerSocieteId: req.user.societeId,
        select: {
          id: true,
          prenom: true,
          nom: true,
          email: true,
          role: true,
          actif: true,
          loginCount: true,
          createdAt: true,
          lastLoginAt: true,
          permissions: true,
          societe: { select: { id: true, nom: true, code: true } },
        },
      });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ message: "Utilisateur introuvable" });
      throw error;
    }

    const permissions =
      user.permissions && typeof user.permissions === "object" && !Array.isArray(user.permissions)
        ? user.permissions
        : {};

    return res.json({ ...user, permissions });
  } catch (err) {
    return next(err);
  }
}

async function resetUserPermissions(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const result = await usersService.resetUserPermissionOverrides({
      targetUserId: id,
      callerId: req.user.id,
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
      req,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  listPendingUsers,
  approveUser,
  rejectUser,
  updateUserRole,
  updateUserStatus,
  resetUserPassword,
  sendUserInvitation,
  createUser,
  auditLog,
  getMe,
  updateMyProfile,
  getMyAudit,
  uploadMyAvatar,
  getUserPermissions,
  updateUserPermissions,
  patchUserPermissionsJson,
  getUserById,
  resetUserPermissions,
  roleValidation,
  activeValidation,
};

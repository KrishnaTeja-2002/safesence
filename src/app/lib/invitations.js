let invitations = new Map();

export function getInvitations() {
  return invitations;
}

export function setInvitation(token, data) {
  invitations.set(token, data);
}

export function clearInvitations() {
  invitations = new Map();
}
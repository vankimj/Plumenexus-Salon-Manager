import { createContext, useContext, useEffect, useState } from 'react';
import { subscribeCustomRoles } from '../lib/customRoles';
import { subscribeTenant } from '../lib/currentTenant';

// Holds the admin "Preview as role" selection app-wide. In-memory only — a
// preview never survives an app relaunch (so an admin can't get permanently
// stuck previewing), and it clears on tenant switch / sign-out. The custom-role
// overlay is kept here too so the picker can list custom roles and
// useTenantAccess can resolve a previewed custom role's capabilities.
const PreviewRoleContext = createContext({
  previewRole: null,
  setPreviewRole: () => {},
  overlay: { roles: [], overrides: {} },
});

export function PreviewRoleProvider({ children }) {
  const [previewRole, setPreviewRole] = useState(null);
  const [overlay, setOverlay] = useState({ roles: [], overrides: {} });

  // Live custom-role overlay (READ only; managed on web). Re-subscribes on
  // tenant switch and clears any active preview so we never carry one tenant's
  // preview into another.
  useEffect(() => {
    let unsubRoles = subscribeCustomRoles(setOverlay);
    const unsubTenant = subscribeTenant(() => {
      setPreviewRole(null);
      unsubRoles && unsubRoles();
      unsubRoles = subscribeCustomRoles(setOverlay);
    });
    return () => { unsubRoles && unsubRoles(); unsubTenant && unsubTenant(); };
  }, []);

  return (
    <PreviewRoleContext.Provider value={{ previewRole, setPreviewRole, overlay }}>
      {children}
    </PreviewRoleContext.Provider>
  );
}

export function usePreviewRole() {
  return useContext(PreviewRoleContext);
}

export default PreviewRoleContext;

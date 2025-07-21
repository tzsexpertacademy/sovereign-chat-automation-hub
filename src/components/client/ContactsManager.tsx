
import React from 'react';
import ModernContactsInterface from './ModernContactsInterface';

interface ContactsManagerProps {
  clientId: string;
}

const ContactsManager = ({ clientId }: ContactsManagerProps) => {
  return <ModernContactsInterface clientId={clientId} />;
};

export default ContactsManager;

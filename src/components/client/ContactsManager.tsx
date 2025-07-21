import React from 'react';
import ContactsManagerSimplified from './ContactsManagerSimplified';

interface ContactsManagerProps {
  clientId: string;
}

const ContactsManager = ({ clientId }: ContactsManagerProps) => {
  return <ContactsManagerSimplified clientId={clientId} />;
};

export default ContactsManager;
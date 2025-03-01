import { DefaultFooter } from '@ant-design/pro-components';
import React from 'react';

const Footer: React.FC = () => {
  return (
    <DefaultFooter
      style={{
        background: 'none',
      }}
      copyright={`${new Date().getFullYear()} 芊寻云仓通 - 一体化余额管理平台`}
      links={[
        {
          key: 'cloud-warehouse',
          title: '芊寻云仓通',
          href: '#',
          blankTarget: false,
        },
      ]}
    />
  );
};

export default Footer;
